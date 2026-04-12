// ─── Algorithme de suggestion de paires par terrain ──────────────────────────
//
// Principe :
// - On ne suggère que des joueurs PRESENT et non déjà sur un terrain
// - On privilégie les matchs entre joueurs de rang proche (ATP)
// - On privilégie les joueurs qui ont le moins joué dans la séance
// - Un arbitre DISPENSE peut être assigné à un terrain

import { Entry } from './ranking';
import { canPlay, canReferee, Status } from './availability';


export interface PlayerEntry extends Entry {
  status: Status;
  wins: number;
  losses: number;
  referees: number;
}

export interface CourtMatch {
  courtId: number;
  player1Id: string;
  player2Id: string;
  refereeId?: string;
  suggestedAt: string;
  startedAt?: string;
  // résultat
  winnerId?: string;
  loserId?: string;
  isAuto: boolean;
  completedAt?: string;
}

// Suggère la meilleure paire pour un terrain libre
// busyPlayerIds = joueurs déjà sur un terrain
export function suggestPair(
  entries: PlayerEntry[],
  busyPlayerIds: Set<string>,
  alreadyPaired: Set<string> // paires déjà jouées ensemble dans la séance (pour varier)
): { player1Id: string; player2Id: string; refereeId?: string } | null {
  // Joueurs disponibles = PRESENT et pas sur un terrain
  const available = entries
    .filter(e => canPlay(e.status) && !busyPlayerIds.has(e.studentId))
    .sort((a, b) => {
      // Priorité : moins de matches joués d'abord, puis rang
      const matchesA = a.wins + a.losses;
      const matchesB = b.wins + b.losses;
      if (matchesA !== matchesB) return matchesA - matchesB;
      return b.points - a.points; // meilleur classement en cas d'égalité
    });

  if (available.length < 2) return null;

  // Trouve la meilleure paire : rang le plus proche possible
  // en évitant les paires déjà jouées si possible
  let bestPair: [PlayerEntry, PlayerEntry] | null = null;
  let bestScore = Infinity;

  const sorted = [...entries].sort((a, b) => b.points - a.points || a.order - b.order);

  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      const p1 = available[i];
      const p2 = available[j];
      const rankDiff = Math.abs(
        sorted.findIndex(e => e.studentId === p1.studentId) -
        sorted.findIndex(e => e.studentId === p2.studentId)
      );
      const pairKey = [p1.studentId, p2.studentId].sort().join('_');
      const alreadyPlayed = alreadyPaired.has(pairKey) ? 10 : 0; // pénalité si déjà joué
      const matchImbalance = Math.abs((p1.wins + p1.losses) - (p2.wins + p2.losses));
      const score = rankDiff + alreadyPlayed + matchImbalance * 0.5;

      if (score < bestScore) {
        bestScore = score;
        bestPair = [p1, p2];
      }
    }
  }

  if (!bestPair) return null;

  // Cherche un arbitre disponible (PRESENT ou DISPENSE, pas sur un terrain)
  const possibleReferees = entries.filter(
    e => canReferee(e.status)
      && !busyPlayerIds.has(e.studentId)
      && e.studentId !== bestPair![0].studentId
      && e.studentId !== bestPair![1].studentId
  );
  // Priorité aux DISPENSE (ils ne peuvent pas jouer)
  const referee = possibleReferees.find(e => e.status === 'DISPENSE')
    ?? possibleReferees[0];

  return {
    player1Id: bestPair[0].studentId,
    player2Id: bestPair[1].studentId,
    refereeId: referee?.studentId
  };
}

// Suggère les paires pour tous les terrains libres d'un coup
export function suggestAllCourts(
  courtCount: number,
  entries: PlayerEntry[],
  activeMatches: CourtMatch[]
): Array<{ courtId: number; suggestion: ReturnType<typeof suggestPair> }> {
  const busyPlayerIds = new Set<string>();
  const alreadyPaired = new Set<string>();

  // Marque les joueurs déjà sur un terrain actif
  for (const m of activeMatches) {
    if (!m.completedAt) {
      busyPlayerIds.add(m.player1Id);
      busyPlayerIds.add(m.player2Id);
      if (m.refereeId) busyPlayerIds.add(m.refereeId);
      alreadyPaired.add([m.player1Id, m.player2Id].sort().join('_'));
    }
  }

  // Terrains occupés
  const occupiedCourts = new Set(activeMatches.filter(m => !m.completedAt).map(m => m.courtId));

  const suggestions: Array<{ courtId: number; suggestion: ReturnType<typeof suggestPair> }> = [];

  for (let courtId = 1; courtId <= courtCount; courtId++) {
    if (occupiedCourts.has(courtId)) continue; // terrain occupé

    const suggestion = suggestPair(entries, busyPlayerIds, alreadyPaired);
    if (suggestion) {
      suggestions.push({ courtId, suggestion });
      // Marque ces joueurs comme busy pour les prochains terrains
      busyPlayerIds.add(suggestion.player1Id);
      busyPlayerIds.add(suggestion.player2Id);
      if (suggestion.refereeId) busyPlayerIds.add(suggestion.refereeId);
      alreadyPaired.add([suggestion.player1Id, suggestion.player2Id].sort().join('_'));
    }
  }

  return suggestions;
}
