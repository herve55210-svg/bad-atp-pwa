import { stableSort, getRank, Entry } from './ranking';

export type Settings = { arbPoints: number; loserPoints: number; diffCap: number; autoRefBonus: number };

export function computeWinnerGain(rankWinner: number, rankLoser: number, diffCap: number): number {
  const k = Math.min(Math.abs(rankLoser - rankWinner), diffCap);
  if (rankLoser < rankWinner) {
    // loser was above winner (better rank number smaller)
    return 3.0 + 0.5 * k; // k=1..5 => 3.5..5.5
  }
  if (rankLoser > rankWinner) {
    // loser was below winner
    return 3.5 - 0.5 * k; // k=1..5 => 3.0..1.0
  }
  return 3.0; // same rank shouldn't happen; neutral default
}

export type MatchOutcome = {
  winnerId: string;
  loserId: string;
  refereeId?: string;
  isAuto: boolean;
};

export type ApplyResult = {
  delta: Record<string, number>; // points delta
  stats: Record<string, { wins?: number; losses?: number; referees?: number }>;
  winnerGain: number;
};

export function applyMatch(entries: Entry[], settings: Settings, outcome: MatchOutcome): ApplyResult {
  const sorted = stableSort(entries);
  const rankW = getRank(outcome.winnerId, sorted);
  const rankL = getRank(outcome.loserId, sorted);

  const winnerGain = computeWinnerGain(rankW, rankL, settings.diffCap);
  const delta: Record<string, number> = {};
  const stats: Record<string, { wins?: number; losses?: number; referees?: number }> = {};

  delta[outcome.winnerId] = (delta[outcome.winnerId] ?? 0) + winnerGain + (outcome.isAuto ? settings.autoRefBonus : 0);
  delta[outcome.loserId] = (delta[outcome.loserId] ?? 0) + settings.loserPoints;

  stats[outcome.winnerId] = { ...(stats[outcome.winnerId] ?? {}), wins: 1 };
  stats[outcome.loserId] = { ...(stats[outcome.loserId] ?? {}), losses: 1 };

  if (!outcome.isAuto && outcome.refereeId) {
    delta[outcome.refereeId] = (delta[outcome.refereeId] ?? 0) + settings.arbPoints;
    stats[outcome.refereeId] = { ...(stats[outcome.refereeId] ?? {}), referees: 1 };
  }

  return { delta, stats, winnerGain };
}

export function applyArbitrage(settings: Settings, studentId: string) {
  return {
    delta: { [studentId]: settings.arbPoints },
    stats: { [studentId]: { referees: 1 } }
  };
}
