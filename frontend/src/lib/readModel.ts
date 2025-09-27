// src/lib/readModel.ts
import {
  Contract,
  Log,
  keccak256,
  toUtf8Bytes,
  getAddress,
  type BigNumberish,
} from 'ethers';
import { escrow } from './contracts';
import { useWalletStore } from './hedera';

export type RoundStatus = 'Upcoming' | 'Betting' | 'Locked' | 'Resolving' | 'Resolved';

export type RoundCore = {
  id: number;
  market: string;      // bytes32 0x…; we keep raw and may render ascii elsewhere
  startTs: number;
  lockTs: number;
  resolveTs: number;
  refPrice: bigint;    // int64 scaled (8dp)
  settledPrice: bigint;// int64 scaled (8dp)
  resolved: boolean;
  resultSide: number;  // 0:FLAT, 1:UP, 2:DOWN (align with your enum)
  feeBps: number;
  feePaid: boolean;
};

export type RoundVM = RoundCore & {
  status: RoundStatus;
  now: number;
  // pools
  poolUp: bigint;
  poolDown: bigint;
  // user
  userUp: bigint;
  userDown: bigint;
  claimable: bigint;
  canClaim: boolean;
  reason?: string;
};

// -------- helpers --------
const BTC = keccak256(toUtf8Bytes('BTC/USD'));

function n(x: BigNumberish | undefined): number { return x == null ? 0 : Number(x.toString()); }
function b(x: BigNumberish | undefined): bigint { return x == null ? 0n : BigInt(x.toString()); }

function computeStatus(now: number, r: RoundCore): RoundStatus {
  if (r.resolved) return 'Resolved';
  if (now < r.startTs) return 'Upcoming';
  if (now < r.lockTs) return 'Betting';
  if (now < r.resolveTs) return 'Locked';
  return 'Resolving';
}

// Derived claimable (mirror EscrowGame logic): FLAT => refund; otherwise pro-rata from (up+down-fee)
function computeClaimable(
  r: RoundCore,
  poolUp: bigint,
  poolDown: bigint,
  userUp: bigint,
  userDown: bigint
): { claimable: bigint; canClaim: boolean; reason?: string } {
  if (!r.resolved) return { claimable: 0n, canClaim: false, reason: 'Round not resolved' };

  const total = poolUp + poolDown;

  if (r.resultSide === 0) {
    const refund = userUp + userDown;
    return { claimable: refund, canClaim: refund > 0n, reason: refund > 0n ? undefined : 'No bets placed' };
  }

  const fee = (total * BigInt(r.feeBps)) / 10000n;
  const distributable = total - fee;

  if (r.resultSide === 1) {
    if (userUp === 0n) return { claimable: 0n, canClaim: false, reason: 'Lost or did not bet UP' };
    const denom = poolUp === 0n ? 1n : poolUp;
    return { claimable: (distributable * userUp) / denom, canClaim: true };
  }
  if (r.resultSide === 2) {
    if (userDown === 0n) return { claimable: 0n, canClaim: false, reason: 'Lost or did not bet DOWN' };
    const denom = poolDown === 0n ? 1n : poolDown;
    return { claimable: (distributable * userDown) / denom, canClaim: true };
  }
  return { claimable: 0n, canClaim: false, reason: 'Unknown result' };
}

// -------- contract tuple decoding (adjust types if needed) --------
type RoundTuple = [
  string,        // market
  BigNumberish,  // startTs
  BigNumberish,  // lockTs
  BigNumberish,  // resolveTs
  BigNumberish,  // refPrice
  BigNumberish,  // settledPrice
  boolean,       // resolved
  BigNumberish,  // resultSide
  BigNumberish,  // feeBps
  boolean        // feePaid
];

async function tryGetRoundView(c: Contract, id: number): Promise<RoundCore | null> {
  try {
    const t = (await c.getRound(id)) as RoundTuple;
    return {
      id,
      market: t[0],
      startTs: n(t[1]),
      lockTs: n(t[2]),
      resolveTs: n(t[3]),
      refPrice: b(t[4]),
      settledPrice: b(t[5]),
      resolved: Boolean(t[6]),
      resultSide: n(t[7]),
      feeBps: n(t[8]),
      feePaid: Boolean(t[9]),
    };
  } catch {
    return null;
  }
}

// Events fallback if getRound() is missing
// const Created = 'event RoundCreated(uint256 indexed id, bytes32 market, uint64 startTs, uint64 lockTs, uint64 resolveTs)';
// const Resolved = 'event RoundResolved(uint256 indexed id, uint8 resultSide, int64 settledPrice)';
// const BetPlaced = 'event BetPlaced(uint256 indexed id, address indexed user, bool isUp, uint256 amount)';

async function reconstructRoundFromEvents(c: Contract, id: number): Promise<RoundCore | null> {
  try {
    const iface = c.interface;
    const createdEvent = iface.getEvent('RoundCreated');
    const resolvedEvent = iface.getEvent('RoundResolved');
    
    if (!createdEvent || !resolvedEvent) return null;
    
    const topicCreated = createdEvent.topicHash;
    const topicResolved = resolvedEvent.topicHash;

    const logs: Log[] = await c.runner!.provider!.getLogs({
      address: c.target as string,
      fromBlock: 0n,
      toBlock: 'latest',
      topics: [
        [topicCreated, topicResolved],
        '0x' + id.toString(16).padStart(64, '0'),
      ],
    });

    let core: Partial<RoundCore> = { id, market: BTC, refPrice: 0n, settledPrice: 0n, feePaid: false, feeBps: 0 };
    for (const log of logs) {
      try {
        const p = iface.parseLog(log);
        if (p && p.name === 'RoundCreated') {
          const { market, startTs, lockTs, resolveTs } = p.args as any;
          core.market = market;
          core.startTs = Number(startTs);
          core.lockTs = Number(lockTs);
          core.resolveTs = Number(resolveTs);
          core.resolved = false;
          core.resultSide = 0;
        } else if (p && p.name === 'RoundResolved') {
          const { resultSide, settledPrice } = p.args as any;
          core.resolved = true;
          core.resultSide = Number(resultSide);
          core.settledPrice = BigInt(settledPrice.toString());
        }
      } catch { /* ignore */ }
    }
    if (core.startTs == null) return null;
    return core as RoundCore;
  } catch {
    return null;
  }
}

// -------- public API --------
export async function loadRounds(user?: string): Promise<RoundVM[]> {
  const eg = escrow();
  const cRead = eg.read();

  // normalize user
  let userAddr: string | null = null;
  try { if (user) userAddr = getAddress(user); } catch {}

  const next = Number(await cRead.nextRoundId());
  if (!next) return [];

  const cores = await Promise.all(
    Array.from({ length: next }, async (_, id) => {
      const viaView = await tryGetRoundView(cRead, id);
      if (viaView) return viaView;
      return await reconstructRoundFromEvents(cRead, id);
    })
  );

  const now = Math.floor(Date.now() / 1000);

  const vms = await Promise.all(
    cores.map(async (core) => {
      if (!core) return null;
      const id = core.id;

      // Pools (adjust names if your ABI differs)
      let poolUp = 0n, poolDown = 0n;
      try { poolUp = BigInt((await cRead.upStakes(id)).toString()); } catch {}
      try { poolDown = BigInt((await cRead.downStakes(id)).toString()); } catch {}

      // User stakes
      let userUp = 0n, userDown = 0n;
      if (userAddr) {
        try { userUp = BigInt((await cRead.userUpStake(id, userAddr)).toString()); } catch {}
        try { userDown = BigInt((await cRead.userDownStake(id, userAddr)).toString()); } catch {}
      }

      const status = computeStatus(now, core);
      const { claimable, canClaim, reason } = computeClaimable(core, poolUp, poolDown, userUp, userDown);

      const vm: RoundVM = {
        ...core,
        status,
        now,
        poolUp,
        poolDown,
        userUp,
        userDown,
        claimable,
        canClaim,
        reason,
      };
      return vm;
    })
  );

  return vms.filter(Boolean) as RoundVM[];
}

export async function loadMyRounds(): Promise<RoundVM[]> {
  const { address } = useWalletStore.getState();
  return loadRounds(address ?? undefined);
}
