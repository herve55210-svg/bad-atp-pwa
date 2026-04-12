import { db } from './db';

const nowIso = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

export async function ensureSeedData() {
  const n = await db.settings.count();
  if (n > 0) return;

  const settingsId = uuid();
  await db.settings.add({
    id: settingsId,
    maxChallengeDisplay: 5,
    arbPoints: 0.5,
    loserPoints: 0.5,
    diffCap: 5,
    autoRefBonus: 0,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });

  // optional: create an example class to show app works
  const classId = uuid();
  await db.classes.add({ id: classId, name: 'DEMO', createdAt: nowIso(), updatedAt: nowIso() });

  const demoStudents = [
    ['BOISSEAU','Yannick'],
    ['BLAZIN','Vincent'],
    ['BREMOND','Charlie'],
    ['CHARLES','Anna'],
    ['GARCIA','Iden'],
    ['GRANIER','Elise'],
    ['JABOUK','Emma']
  ];

  for (const [lastName, firstName] of demoStudents) {
    const normalizedKey = normalize(`${lastName}_${firstName}`);
    await db.students.add({
      id: uuid(),
      classId,
      lastName,
      firstName,
      normalizedKey,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  }
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}
