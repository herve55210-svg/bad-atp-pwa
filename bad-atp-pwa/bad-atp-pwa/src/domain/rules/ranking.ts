export type Entry = { studentId: string; points: number; order: number; status?: 'PRESENT'|'ABSENT'|'DISPENSE' };

export function stableSort(entries: Entry[]): Entry[] {
  return [...entries].sort((a,b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.order - b.order;
  });
}

export function getRank(studentId: string, sorted: Entry[]): number {
  const idx = sorted.findIndex(e => e.studentId === studentId);
  return idx === -1 ? -1 : idx + 1; // 1-based
}

export function getChallengeCandidates(studentId: string, sorted: Entry[], maxAbove: number): string[] {
  const r = getRank(studentId, sorted);
  if (r <= 1) return [];
  const start = Math.max(1, r - maxAbove);
  const ids: string[] = [];
  for (let rank = r - 1; rank >= start; rank--) {
    ids.push(sorted[rank - 1].studentId);
  }
  return ids;
}
