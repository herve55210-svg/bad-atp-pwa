import { db } from '../../../domain/services/persistence/db';
import { uuid } from '../../../domain/utils/uuid';


const nowIso = () => new Date().toISOString();

export async function createSessionForToday(tournamentId: string): Promise<string> {
  const t = await db.tournaments.get(tournamentId);
  if (!t) throw new Error('Tournoi introuvable');
  const today = new Date();
  const date = today.toISOString().slice(0,10);
  const existing = await db.sessions.where({ tournamentId, date }).first();
  if (existing) return existing.id;

  const label = `Séance ${date.split('-').reverse().join('/')}`;
  const sessionId = uuid();
  await db.sessions.add({ id: sessionId, tournamentId, date, label, createdAt: nowIso() });

  // find previous session (most recent)
  const prev = await db.sessions.where('tournamentId').equals(tournamentId).sortBy('date');
  const prevSession = prev.filter(s => s.date < date).slice(-1)[0];

  const students = await db.students.where('classId').equals(t.classId).toArray();
  // base points/order
  let base: Array<{ studentId: string; points: number; order: number }> = [];
  if (prevSession) {
    const prevEntries = await db.sessionEntries.where('sessionId').equals(prevSession.id).toArray();
    base = prevEntries.map(e => ({ studentId: e.studentId, points: e.points, order: e.order }));
  } else {
    // initial points from alphabetical (placeholder: could be drag&drop later)
    const sorted = [...students].sort((a,b) => (a.lastName+a.firstName).localeCompare(b.lastName+b.firstName));
    const N = sorted.length;
    base = sorted.map((s, idx) => ({ studentId: s.id, points: N - idx, order: idx + 1 }));
  }

  const baseMap = new Map(base.map(b => [b.studentId, b]));
  // create entries for all students
  for (const s of students) {
    const b = baseMap.get(s.id) ?? { studentId: s.id, points: 1, order: 9999 };
    await db.sessionEntries.add({
      key: `${sessionId}_${s.id}`,
      sessionId,
      studentId: s.id,
      status: 'PRESENT',
      points: b.points,
      order: b.order,
      wins: 0,
      losses: 0,
      referees: 0,
      updatedAt: nowIso()
    });
  }

  return sessionId;
}
