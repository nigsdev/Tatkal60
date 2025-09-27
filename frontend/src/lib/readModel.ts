// src/lib/readModel.ts
import {
  Contract,
  Log,
  keccak256,
  toUtf8Bytes,
  getAddress,
  type BigNumberish,
} from 'ethers';
import { escrow, HAS_ROUND_STATUS, readRoundStatus } from './contracts';
import { useWalletStore } from './hedera';

export type RoundStatus =
  | 'Upcoming'
  | 'Betting'
  | 'Locked'
  | 'Resolving'
  | 'Resolved';

export type RoundCore = {
  id: number;
  market: string; // bytes32 0x…; we keep raw and may render ascii elsewhere
  startTs: number;
  lockTs: number;
  resolveTs: number;
  refPrice: bigint; // int64 scaled (8dp)
  settledPrice: bigint; // int64 scaled (8dp)
  resolved: boolean;
  resultSide: number; // 0:FLAT, 1:UP, 2:DOWN (align with your enum)
  feeBps: number;
  feePaid: boolean;
  upPool: bigint; // Total UP pool amount
  downPool: bigint; // Total DOWN pool amount
};

export type RoundVM = RoundCore & {
  status: RoundStatus;
  now: number;
  // user stakes
  userUp: bigint;
  userDown: bigint;
  claimable: bigint;
  canClaim: boolean;
  reason?: string;
};

// -------- helpers --------
const BTC = keccak256(toUtf8Bytes('BTC/USD'));

function n(x: BigNumberish | undefined): number {
  return x == null ? 0 : Number(x.toString());
}
function b(x: BigNumberish | undefined): bigint {
  return x == null ? 0n : BigInt(x.toString());
}

// ---- normalization helpers ----
const ROUND_SECONDS = 60; // Tatkal60: 60s rounds
const LOCK_GAP_SECONDS = 10; // lock 10s before resolve (betting window ≈ 50s)

function normTs(t: BigNumberish | undefined): number {
  const n = t == null ? 0 : Number(t.toString());
  // If it looks like milliseconds, convert to seconds
  return n > 2_000_000_000 ? Math.floor(n / 1000) : n;
}

function normalizeCore(r0: RoundCore): RoundCore {
  let start = normTs(r0.startTs);
  let lock = normTs(r0.lockTs);
  let resolve = normTs(r0.resolveTs);

  // Only derive missing times if they are actually missing (0 or undefined)
  if (!start && resolve) start = Math.max(0, resolve - ROUND_SECONDS);
  if (!resolve && start) resolve = start + ROUND_SECONDS;
  if (!lock && start) {
    lock = resolve
      ? Math.max(start, resolve - LOCK_GAP_SECONDS)
      : start + (ROUND_SECONDS - LOCK_GAP_SECONDS);
  }

  // Only apply sanity clamps if the values are clearly wrong (e.g., start > resolve)
  // But DON'T override valid contract values
  if (resolve && start && start > resolve) {
    start = Math.max(0, resolve - ROUND_SECONDS);
  }

  // Only derive lock if it's missing, but don't override existing values
  if (!lock && resolve) {
    lock = Math.max(start || 0, resolve - LOCK_GAP_SECONDS);
  }

  // DON'T enforce ordering if values are already valid from contract
  // Only apply guards for negative values
  start = Math.max(0, start);
  lock = Math.max(0, lock);
  resolve = Math.max(0, resolve);

  return {
    ...r0,
    startTs: start,
    lockTs: lock,
    resolveTs: resolve,
    resultSide: Number(r0.resultSide ?? 0),
    resolved: Boolean(r0.resolved),
  };
}

function computeStatus(now: number, r: RoundCore): RoundStatus {
  if (r.resolved) return 'Resolved';
  if (now < r.startTs) return 'Upcoming';
  // If lock is missing/zero, treat [start, resolve) as Betting
  if (!r.lockTs && now < r.resolveTs) return 'Betting';
  if (now < r.lockTs) return 'Betting';
  if (now < r.resolveTs) return 'Locked';
  return 'Resolving';
}

function statusFromNum(n: number): RoundStatus {
  switch (Number(n)) {
    case 1:
      return 'Upcoming';
    case 2:
      return 'Betting';
    case 3:
      return 'Locked';
    case 4:
      return 'Resolving';
    case 5:
      return 'Resolved';
    default:
      return 'Upcoming';
  }
}

// Derived claimable (mirror EscrowGame logic): FLAT => refund; otherwise pro-rata from (up+down-fee)
function computeClaimable(
  r: RoundCore,
  poolUp: bigint,
  poolDown: bigint,
  userUp: bigint,
  userDown: bigint
): { claimable: bigint; canClaim: boolean; reason?: string } {
  if (!r.resolved)
    return { claimable: 0n, canClaim: false, reason: 'Round not resolved' };

  const total = poolUp + poolDown;

  if (r.resultSide === 0 || r.resultSide === 3) {
    // FLAT - refund all stakes (contract uses 0 or 3 for FLAT)
    const refund = userUp + userDown;
    return {
      claimable: refund,
      canClaim: refund > 0n,
      reason: refund > 0n ? undefined : 'No bets placed',
    };
  }

  const fee = (total * BigInt(r.feeBps)) / 10000n;
  const distributable = total - fee;

  if (r.resultSide === 1) {
    if (userUp === 0n)
      return {
        claimable: 0n,
        canClaim: false,
        reason: 'Lost or did not bet UP',
      };
    const denom = poolUp === 0n ? 1n : poolUp;
    return { claimable: (distributable * userUp) / denom, canClaim: true };
  }
  if (r.resultSide === 2) {
    if (userDown === 0n)
      return {
        claimable: 0n,
        canClaim: false,
        reason: 'Lost or did not bet DOWN',
      };
    const denom = poolDown === 0n ? 1n : poolDown;
    return { claimable: (distributable * userDown) / denom, canClaim: true };
  }
  return { claimable: 0n, canClaim: false, reason: 'Unknown result' };
}

// -------- contract tuple decoding (adjust types if needed) --------
type RoundTuple = [
  BigNumberish, // id
  string, // market
  BigNumberish, // startTs
  BigNumberish, // lockTs
  BigNumberish, // resolveTs
  BigNumberish, // refPrice
  BigNumberish, // settledPrice
  BigNumberish, // upPool
  BigNumberish, // downPool
  boolean, // resolved
  boolean, // feePaid
  BigNumberish, // outcome
];

async function tryGetRoundView(
  c: Contract,
  id: number
): Promise<RoundCore | null> {
  try {
    const t = (await c.getRound(id)) as RoundTuple;
    return {
      id: n(t[0]), // Use the id from contract
      market: t[1],
      startTs: n(t[2]),
      lockTs: n(t[3]),
      resolveTs: n(t[4]),
      refPrice: b(t[5]),
      settledPrice: b(t[6]),
      resolved: Boolean(t[9]),
      resultSide: n(t[11]), // outcome
      feeBps: 500, // Default fee rate (5%)
      feePaid: Boolean(t[10]),
      // Extract pool data from the Round struct
      upPool: b(t[7]), // upPool from Round struct
      downPool: b(t[8]), // downPool from Round struct
    };
  } catch {
    return null;
  }
}

// Events fallback if getRound() is missing
// const Created = 'event RoundCreated(uint256 indexed id, bytes32 market, uint64 startTs, uint64 lockTs, uint64 resolveTs)';
// const Resolved = 'event RoundResolved(uint256 indexed id, uint8 resultSide, int64 settledPrice)';
// const BetPlaced = 'event BetPlaced(uint256 indexed id, address indexed user, bool isUp, uint256 amount)';

async function reconstructRoundFromEvents(
  c: Contract,
  id: number
): Promise<RoundCore | null> {
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

    let core: Partial<RoundCore> = {
      id,
      market: BTC,
      refPrice: 0n,
      settledPrice: 0n,
      feePaid: false,
      feeBps: 0,
    };
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
      } catch {
        /* ignore */
      }
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
  try {
    if (user) userAddr = getAddress(user);
  } catch (error) {
    console.warn('[readModel] Invalid user address:', user, error);
  }

  const next = Number(await cRead.nextRoundId());
  if (!next) return [];

  const cores = await Promise.all(
    Array.from({ length: next }, async (_, id) => {
      const viaView = await tryGetRoundView(cRead, id);
      if (viaView) return viaView;
      return await reconstructRoundFromEvents(cRead, id);
    })
  );

  // normalize & drop ghost rounds
  const normCores: RoundCore[] = (cores.filter(Boolean) as RoundCore[])
    .map(normalizeCore)
    .filter(
      c =>
        !(c.startTs === 0 && c.lockTs === 0 && c.resolveTs === 0 && !c.resolved)
    );

  // Get chain time instead of local time to avoid time mismatches
  let now: number;
  try {
    const provider = escrow().read().runner?.provider;
    if (provider) {
         const block = await provider.getBlock('latest');
         now = block?.timestamp || Math.floor(Date.now() / 1000);
    } else {
      now = Math.floor(Date.now() / 1000);
    }
  } catch (e) {
    console.warn('[readModel] Failed to get chain time, falling back to local time', e);
    now = Math.floor(Date.now() / 1000);
  }

  const vms = await Promise.all(
    normCores.map(async core => {
      const id = core.id;

      // Use pool data from the Round struct (already fetched in tryGetRoundView)
      const poolUp = core.upPool || 0n;
      const poolDown = core.downPool || 0n;

      // User stakes
      let userUp = 0n,
        userDown = 0n;
      if (userAddr) {
        try {
          // Use the correct function name from the contract
          const [upStake, downStake] = await cRead.getUserStakes(id, userAddr);
          userUp = BigInt(upStake.toString());
          userDown = BigInt(downStake.toString());
          
        } catch (error) {
          console.warn(`Failed to get user stakes for round ${id}:`, error);
        }
      }

      let status: RoundStatus;
      if (HAS_ROUND_STATUS) {
        try {
          const n = await readRoundStatus(id);
          status = statusFromNum(n);
        } catch {
          status = computeStatus(now, core);
        }
      } else {
        status = computeStatus(now, core);
      }
      const { claimable, canClaim, reason } = computeClaimable(
        core,
        poolUp,
        poolDown,
        userUp,
        userDown
      );

      const vm: RoundVM = {
        ...core,
        status,
        now,
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
