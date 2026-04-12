// crypto.randomUUID() ne fonctionne que sur HTTPS sur Safari iOS
// Cette fonction marche partout (HTTP local inclus)
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID(); } catch {}
  }
  // Fallback compatible HTTP + vieux Safari
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
