import Dexie, { Table } from 'dexie';

export type ClassRow = { id: string; name: string; createdAt: string; updatedAt: string; isArchived?: number };
export type StudentRow = { id: string; classId: string; lastName: string; firstName: string; normalizedKey: string; photoBlob?: Blob; photoUpdatedAt?: string; createdAt: string; updatedAt: string };
export type SettingsRow = { id: string; maxChallengeDisplay: number; arbPoints: number; loserPoints: number; diffCap: number; autoRefBonus: number; createdAt: string; updatedAt: string };
export type TournamentRow = { id: string; classId: string; name: string; settingsId: string; createdAt: string; updatedAt: string; isArchived?: number };
export type SessionRow = { id: string; tournamentId: string; date: string; label: string; createdAt: string; isLocked?: number };
export type SessionEntryRow = { key: string; sessionId: string; studentId: string; status: 'PRESENT'|'ABSENT'|'DISPENSE'; points: number; order: number; wins: number; losses: number; referees: number; updatedAt: string };
export type EventRow = { id: string; sessionId: string; timestamp: string; type: 'ARBITRAGE'|'MATCH_REFEREED'|'MATCH_AUTO'|'MANUAL_POINTS_EDIT'|'STATUS_CHANGE'; winnerId?: string; loserId?: string; refereeId?: string; deltaWinner?: number; deltaLoser?: number; deltaReferee?: number; notes?: string };

export class BadATPDB extends Dexie {
  classes!: Table<ClassRow, string>;
  students!: Table<StudentRow, string>;
  settings!: Table<SettingsRow, string>;
  tournaments!: Table<TournamentRow, string>;
  sessions!: Table<SessionRow, string>;
  sessionEntries!: Table<SessionEntryRow, string>;
  events!: Table<EventRow, string>;

  constructor() {
    super('bad-atp-pwa');
    this.version(1).stores({
      classes: 'id, name, isArchived',
      students: 'id, classId, normalizedKey',
      settings: 'id',
      tournaments: 'id, classId, isArchived',
      sessions: 'id, tournamentId, date',
      sessionEntries: 'key, sessionId, studentId',
      events: 'id, sessionId, timestamp'
    });
  }
}

export const db = new BadATPDB();
