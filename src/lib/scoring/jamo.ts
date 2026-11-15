export function normalizeHangul(s: string): string { return s.normalize('NFC').replace(/[^\uAC00-\uD7A3]/gu, ''); }
function tokens(s: string): string[] {
  return [...normalizeHangul(s)].flatMap(syllable => {
    const i = syllable.charCodeAt(0) - 0xAC00;
    return [`c${Math.floor(i / 588)}`, `v${Math.floor((i % 588) / 28)}`, ...(i % 28 ? [`f${i % 28}`] : [])];
  });
}
export function jamoSimilarity(a: string, b: string): number {
  const left = tokens(a), right = tokens(b);
  if (!left.length || !right.length) return 0;
  let row = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 0; i < left.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < right.length; j++) next[j + 1] = Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (left[i] === right[j] ? 0 : 1));
    row = next;
  }
  return 1 - row[right.length] / Math.max(left.length, right.length);
}
