export function shortAddress(addr?: string, head = 6, tail = 4) {
  if (!addr) return '';
  return addr.length > head + tail ? `${addr.slice(0, head)}…${addr.slice(-tail)}` : addr;
}

export function formatHBAR(v?: bigint | number | string) {
  const n = typeof v === 'bigint' ? Number(v) : Number(v ?? 0);
  if (!isFinite(n)) return '0';
  if (n >= 1) return n.toFixed(3);
  if (n === 0) return '0';
  return n.toPrecision(3);
}

