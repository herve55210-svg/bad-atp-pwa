// ─── Sauvegarde / Restauration complète ──────────────────────────────────────
// Export JSON de toutes les tables (sans photoBlob).
// Transfert via AirDrop ou iCloud Drive entre appareils.

import { db } from './db';

const SNAPSHOT_VERSION = 1;

export interface Snapshot {
  version: number;
  exportedAt: string;
  deviceHint: string;
  tables: {
    classes: unknown[];
    students: unknown[];
    settings: unknown[];
    tournaments: unknown[];
    sessions: unknown[];
    sessionEntries: unknown[];
    events: unknown[];
  };
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportSnapshot(deviceHint = 'Mon appareil'): Promise<string> {
  const [classes, studentsRaw, settings, tournaments, sessions, sessionEntries, events] =
    await Promise.all([
      db.classes.toArray(),
      db.students.toArray(),
      db.settings.toArray(),
      db.tournaments.toArray(),
      db.sessions.toArray(),
      db.sessionEntries.toArray(),
      db.events.toArray(),
    ]);

  // Exclut photoBlob (non sérialisable + trop lourd)
  const students = studentsRaw.map((s) => { const { photoBlob, photoUpdatedAt, ...rest } = s; return rest; });

  const snapshot: Snapshot = {
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    deviceHint,
    tables: { classes, students, settings, tournaments, sessions, sessionEntries, events },
  };

  return JSON.stringify(snapshot, null, 2);
}

export function triggerJsonDownload(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import ────────────────────────────────────────────────────────────────────

export type ImportMode = 'merge' | 'replace';

export interface ImportResult {
  ok: boolean;
  message: string;
  counts?: Record<string, number>;
}

type AnyRow = Record<string, unknown> & { updatedAt?: string; createdAt?: string };

export async function importSnapshot(json: string, mode: ImportMode): Promise<ImportResult> {
  let snapshot: Snapshot;
  try {
    snapshot = JSON.parse(json);
  } catch {
    return { ok: false, message: "Fichier invalide — ce n'est pas un JSON Bad ATP." };
  }

  if (!snapshot.tables) {
    return { ok: false, message: "Format non reconnu. Vérifie que c'est bien un export Bad ATP." };
  }

  const { classes, students, settings, tournaments, sessions, sessionEntries, events } = snapshot.tables;

  try {
    if (mode === 'replace') {
      await Promise.all([
        db.classes.clear(), db.students.clear(), db.settings.clear(),
        db.tournaments.clear(), db.sessions.clear(),
        db.sessionEntries.clear(), db.events.clear(),
      ]);
    }

    const counts: Record<string, number> = {};

    async function upsertRows(
      table: { get: (pk: string) => Promise<AnyRow | undefined>; put: (row: AnyRow) => Promise<unknown> },
      rows: unknown[],
      pkField: string,
      label: string
    ) {
      let n = 0;
      for (const row of rows as AnyRow[]) {
        const pk = row[pkField] as string;
        if (!pk) continue;
        if (mode === 'merge') {
          const existing = await (table as any).get(pk) as AnyRow | undefined;
          if (existing) {
            const existDate = existing.updatedAt ?? existing.createdAt ?? '';
            const importDate = row.updatedAt ?? row.createdAt ?? '';
            if (existDate >= importDate) continue;
          }
        }
        await (table as any).put(row);
        n++;
      }
      counts[label] = n;
    }

    await upsertRows(db.classes,        classes,        'id',  'classes');
    await upsertRows(db.students,       students,       'id',  'élèves');
    await upsertRows(db.settings,       settings,       'id',  'paramètres');
    await upsertRows(db.tournaments,    tournaments,    'id',  'tournois');
    await upsertRows(db.sessions,       sessions,       'id',  'séances');
    await upsertRows(db.sessionEntries, sessionEntries, 'key', 'résultats');
    await upsertRows(db.events,         events,         'id',  'historique');

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const src   = snapshot.deviceHint ? ` (depuis : ${snapshot.deviceHint})` : '';
    const date  = new Date(snapshot.exportedAt).toLocaleString('fr-FR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    return {
      ok: true,
      message: `${total} enregistrements importés${src} — sauvegarde du ${date}`,
      counts
    };
  } catch (e) {
    return { ok: false, message: `Erreur : ${(e as Error).message}` };
  }
}

