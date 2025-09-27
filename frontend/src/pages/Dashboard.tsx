import { RefreshCw, Activity, History } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import LivePrice from '../components/LivePrice';
import RefreshPyth from '../components/RefreshPyth';
import RoundCard from '../components/RoundCard';
import { useRoundsWithEvents } from '../hooks/useRoundsWithEvents';
import EventBusStatus from '../components/EventBusStatus';
import { useMemo, useEffect, useState } from 'react';

function cleanRounds(rounds: any[]): any[] {
  return (rounds || []).filter((r: any) => {
    const start = Number(r?.startTs || 0);
    const lock = Number(r?.lockTs || 0);
    const resolve = Number(r?.resolveTs || 0);
    // drop placeholder rounds
    return !(start === 0 && lock === 0 && resolve === 0 && !r?.resolved);
  });
}

function splitRounds(
  rounds: any[],
  now: number = Math.floor(Date.now() / 1000)
) {
  const grace = 120; // seconds after resolve to keep in Active
  const active: any[] = [];
  const past: any[] = [];
  for (const r of rounds || []) {
    const resolved = !!r?.resolved;
    const resolveTs = Number(r?.resolveTs || 0);
    const isPast = resolved || (resolveTs > 0 && now >= resolveTs + grace);
    (isPast ? past : active).push(r);
  }
  return { active, past };
}

function formatAgo(now: number, ts?: number) {
  if (!ts) return '—';
  const d = Math.max(0, now - ts);
  if (d < 2) return 'just now';
  if (d < 60) return `${d}s ago`;
  const m = Math.floor(d / 60);
  const s = d % 60;
  return `${m}m ${s}s ago`;
}

export default function Dashboard() {
  const pollMs = 6000; // matches useRounds(6000)
  const { rounds, loading, error, lastUpdated, refetch, eventBusStatus } = useRoundsWithEvents(pollMs);

  const { active, past } = useMemo(() => {
    const cleaned = cleanRounds(rounds);
    return splitRounds(cleaned);
  }, [rounds]);

  // live ticker for the "last updated" badge
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      {/* Top row: Live Price and Refresh Pyth */}
      <div className="grid gap-6 lg:grid-cols-2">
        <LivePrice />
        <RefreshPyth />
      </div>

      {/* Active Rounds Section */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-teal-500/20 border border-teal-500/30 flex-shrink-0">
              <Activity size={20} className="text-teal-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                <span>Active Rounds</span>
                {active.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-gray-300 border border-white/10">
                    {active.length}
                  </span>
                )}
              </h2>
              <p className="text-gray-400 text-sm">
                Current betting rounds and their status
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:block text-xs text-gray-400">
              Updated {formatAgo(now, lastUpdated)} • Auto{' '}
              {Math.floor(pollMs / 1000)}s
            </div>
            <EventBusStatus status={eventBusStatus} />
            <Button
              variant="primary"
              onClick={refetch}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 font-semibold hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refetch
            </Button>
          </div>
        </div>

        {/* Active list */}
        {active.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {active.map(r => (
              <RoundCard key={`a-${r.id}`} r={r} onChanged={refetch} />
            ))}
          </div>
        )}

        {/* Active states when empty */}
        {active.length === 0 && loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-400">
              <RefreshCw size={20} className="animate-spin" />
              Loading rounds…
            </div>
          </div>
        )}

        {active.length === 0 && error && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-red-400 font-medium mb-2">
                Error loading rounds
              </div>
              <div className="text-gray-400 text-sm">{error}</div>
            </div>
          </div>
        )}

        {active.length === 0 && !loading && !error && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-gray-400 font-medium mb-2">
                No active rounds
              </div>
              <div className="text-gray-500 text-sm">
                Create a new round from the Admin panel to get started
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Past Rounds Section */}
      {past.length > 0 && (
        <Card className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30 flex-shrink-0">
                <History size={20} className="text-purple-300" />
              </div>
              <div className="min-w-0">
                <h2 className="text-white font-semibold text-lg">
                  Past Rounds
                </h2>
                <p className="text-gray-400 text-sm">
                  Recently resolved or expired rounds
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-400">Showing {past.length}</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {past.map(r => (
              <RoundCard
                key={`p-${r.id}`}
                r={r}
                mode="past"
                onChanged={refetch}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
