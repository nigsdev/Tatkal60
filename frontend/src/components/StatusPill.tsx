export default function StatusPill({
  status,
}: {
  status:
    | 'Upcoming'
    | 'Betting'
    | 'Locked'
    | 'Resolving'
    | 'Resolved'
    | 'Expired';
}) {
  const map: Record<
    string,
    { bg: string; text: string; dot: string; border: string }
  > = {
    Upcoming: {
      bg: 'bg-gradient-to-r from-gray-500/20 to-gray-600/20',
      text: 'text-gray-300',
      dot: 'bg-gray-400',
      border: 'border-gray-500/30',
    },
    Betting: {
      bg: 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20',
      text: 'text-emerald-300',
      dot: 'bg-emerald-400',
      border: 'border-emerald-500/30',
    },
    Locked: {
      bg: 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20',
      text: 'text-yellow-300',
      dot: 'bg-yellow-400',
      border: 'border-yellow-500/30',
    },
    Resolving: {
      bg: 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20',
      text: 'text-cyan-300',
      dot: 'bg-cyan-400',
      border: 'border-cyan-500/30',
    },
    Resolved: {
      bg: 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20',
      text: 'text-purple-300',
      dot: 'bg-purple-400',
      border: 'border-purple-500/30',
    },
    Expired: {
      bg: 'bg-gradient-to-r from-gray-600/20 to-gray-700/20',
      text: 'text-gray-300',
      dot: 'bg-gray-400',
      border: 'border-gray-600/30',
    },
  };

  const styles = map[status] || {
    bg: 'bg-white/10',
    text: 'text-white',
    dot: 'bg-white',
    border: 'border-white/20',
  };

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-300 ${styles.bg} ${styles.text} ${styles.border} ${
        status === 'Betting' ? 'animate-pulse shadow-lg shadow-emerald-500/25' : ''
      }`}
    >
      <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${styles.dot} ${
        status === 'Betting' ? 'animate-ping' : ''
      }`}></div>
      {status}
    </span>
  );
}
