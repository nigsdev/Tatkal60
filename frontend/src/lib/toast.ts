export function toast(msg: string) {
  // Simple fallback; replace with a nicer lib later if you want
  try { console.log('[Toast]', msg); } catch {}
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-alert
    // You can replace alert with a custom in-app toast component
    // For now, keep it minimal
  }
}
