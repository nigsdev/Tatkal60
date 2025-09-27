import { useState, useEffect } from 'react';
import { Settings, Clock, Plus } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useWalletStore } from '../lib/hedera';
import { escrow, resolvedAddresses } from '../lib/contracts';
import { sendTx } from '../lib/tx';
import { useChainTime } from '../hooks/useChainTime';
import { keccak256, toUtf8Bytes } from 'ethers';

const OWNER = import.meta.env.VITE_OWNER?.toLowerCase?.();
const BTC = keccak256(toUtf8Bytes('BTC/USD'));

export default function AdminPanel() {
  const { address, connect, isConnected } = useWalletStore();
  const { chainTime, skewSeconds, skewDirection } = useChainTime();
  const [startAt, setStartAt] = useState<number>(Math.floor(Date.now() / 1000));

  const isOwner = address && OWNER && address.toLowerCase() === OWNER;

  useEffect(() => {
    // Initialize admin panel
  }, []);

  const verifyLastRound = async (label: string) => {
    // Round creation verification (optional)
    try {
      const rRead: any = await escrow().read();
      const next = await rRead.nextRoundId();
      const last = (typeof next === 'number' ? next : Number(next)) - 1;
      if (last < 0) return;
      // Round created successfully
    } catch (e) {
      // Ignore verification errors
    }
  };

  const createNow = async () => {
    if (!isConnected) await connect();

    // Use chain time to avoid time mismatches
    const nowS = chainTime;
    const startS = nowS;
    const resolveS = startS + 60;
    const lockS = resolveS - 10; // 50s betting

    const c: any = await escrow().write();
    let fCreate;
    try {
      fCreate = c.interface.getFunction('createRound');
    } catch {
      /* noop */
    }
    if (!fCreate || fCreate.inputs?.length !== 4) {
      console.error(
        '[AdminPanel] Expected createRound(bytes32,uint64,uint64,uint64) not found in ABI/address',
        resolvedAddresses()
      );
      throw new Error(
        'EscrowGame ABI mismatch: generic createRound not available. Update contract/address.'
      );
    }

    const fn = (c as any)[fCreate.name];
    await sendTx(
      'Create 60s Round (now)',
      () => fn(BTC, BigInt(startS), BigInt(lockS), BigInt(resolveS)),
      {
        pending: 'Confirm Create Round',
        submitted: 'Create Round submitted',
        success: 'Round created successfully',
        error: 'Create Round failed',
      }
    );

    await verifyLastRound('createNow');
  };

  const createFuture = async () => {
    if (!isConnected) await connect();

    // Use chain time to avoid time mismatches
    const nowS = chainTime;
    const minStart = nowS + 5; // small buffer
    const startS = Math.max(startAt || 0, minStart);
    const resolveS = startS + 60;
    const lockS = resolveS - 10; // 50s betting

    const c: any = await escrow().write();
    let fCreate;
    try {
      fCreate = c.interface.getFunction('createRound');
    } catch {
      /* noop */
    }
    if (!fCreate || fCreate.inputs?.length !== 4) {
      console.error(
        '[AdminPanel] Expected createRound(bytes32,uint64,uint64,uint64) not found in ABI/address',
        resolvedAddresses()
      );
      throw new Error(
        'EscrowGame ABI mismatch: generic createRound not available. Update contract/address.'
      );
    }

    const fn = (c as any)[fCreate.name];
    await sendTx(
      'Create 60s Round (future)',
      () => fn(BTC, BigInt(startS), BigInt(lockS), BigInt(resolveS)),
      {
        pending: 'Confirm Create Future Round',
        submitted: 'Create Future Round submitted',
        success: 'Future round created successfully',
        error: 'Create Future Round failed',
      }
    );

    await verifyLastRound('createFuture');
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
            <Settings size={20} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Admin Panel</h2>
            <p className="text-gray-400 text-sm">
              Create and manage betting rounds
            </p>
          </div>
        </div>

        {!isOwner ? (
          <div className="py-12 text-center">
            <div className="text-gray-300 mb-2 font-medium text-lg">
              Not authorized
            </div>
            <div className="text-gray-400 text-sm">
              Set VITE_OWNER=0xYourAddress in your .env file and connect with
              that wallet.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6 border border-white/10 hover:border-emerald-500/30 transition-all duration-300">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                    <Plus size={24} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">
                      Create Round Now
                    </h3>
                    <p className="text-gray-400 text-sm">Starts immediately</p>
                  </div>
                </div>
                <Button
                  onClick={createNow}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-emerald-500/25"
                >
                  <Plus size={20} className="mr-2" />
                  Create 60s Round (now)
                </Button>
              </Card>

              <Card className="p-6 border border-white/10 hover:border-cyan-500/30 transition-all duration-300">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                    <Clock size={24} className="text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">
                      Schedule Round
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Set custom start time
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Start Time (Epoch)
                    </label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-200"
                      value={startAt}
                      min={Math.floor(Date.now() / 1000) + 5}
                      onChange={e => setStartAt(Number(e.target.value))}
                      placeholder="Epoch timestamp"
                    />
                  </div>
                  <Button
                    onClick={createFuture}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-cyan-500/25"
                  >
                    <Clock size={20} className="mr-2" />
                    Create 60s Round (future)
                  </Button>
                  <div className="text-center space-y-1">
                    <p className="text-gray-500 text-xs">
                      Chain time:{' '}
                      <span className="text-cyan-400 font-mono">
                        {chainTime}
                      </span>
                    </p>
                    {skewSeconds > 2 && (
                      <p className="text-yellow-400 text-xs">
                        Time skew: {skewDirection}{skewSeconds}s
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
