import React, { useEffect, useMemo, useState } from 'react';
import { db, SessionEntryRow, StudentRow } from '../../../domain/services/persistence/db';
import { useToast } from '../../components/Toast';

type Status = 'PRESENT' | 'ABSENT' | 'DISPENSE';

const STATUS_CONFIG: Record<Status, { label: string; emoji: string; next: Status }> = {
  PRESENT: { label: 'Présent', emoji: '✅', next: 'ABSENT' },
  ABSENT:  { label: 'Absent',  emoji: '❌', next: 'DISPENSE' },
  DISPENSE:{ label: 'Dispensé', emoji: '🟡', next: 'PRESENT' },
};

export default function QuickRollCall({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const [entries, setEntries] = useState<SessionEntryRow[]>([]);
  const [students, setStudents] = useState<Record<string, StudentRow>>({});
  const { show } = useToast();

  async function refresh() {
    const es = await db.sessionEntries.where('sessionId').equals(sessionId).toArray();
    setEntries(es);
    const ids = es.map(e => e.studentId);
    const ss = await db.students.bulkGet(ids);
    const map: Record<string, StudentRow> = {};
    ss.forEach(s => { if (s) map[s.id] = s; });
    setStudents(map);
  }

  useEffect(() => { refresh(); }, [sessionId]);

  const counts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, DISPENSE: 0 };
    for (const e of entries) c[e.status]++;
    return c;
  }, [entries]);

  async function setStatus(studentId: string, status: Status) {
    const key = `${sessionId}_${studentId}`;
    await db.sessionEntries.update(key, { status, updatedAt: new Date().toISOString() });
    await refresh();
  }

  async function cycleStatus(entry: SessionEntryRow) {
    const next = STATUS_CONFIG[entry.status as keyof typeof STATUS_CONFIG].next;
    await setStatus(entry.studentId, next);
  }

  async function setAllPresent() {
    for (const e of entries) {
      await db.sessionEntries.update(e.key, { status: 'PRESENT', updatedAt: new Date().toISOString() });
    }
    await refresh();
    show('Tous présents ✓');
  }

  const sorted = [...entries].sort((a, b) => {
    const sa = students[a.studentId], sb = students[b.studentId];
    return ((sa?.lastName ?? '') + (sa?.firstName ?? '')).localeCompare((sb?.lastName ?? '') + (sb?.firstName ?? ''));
  });

  return (
    <div>
      {/* Summary bar */}
      <div className="summary-bar">
        <div className="summary-pill" style={{ background: 'var(--green-light)', color: 'var(--green)' }}>
          <span className="num">{counts.PRESENT}</span>Présents
        </div>
        <div className="summary-pill" style={{ background: 'var(--red-light)', color: 'var(--red)' }}>
          <span className="num">{counts.ABSENT}</span>Absents
        </div>
        <div className="summary-pill" style={{ background: 'var(--yellow-light)', color: 'var(--yellow)' }}>
          <span className="num">{counts.DISPENSE}</span>Dispensés
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14, gap: 8 }}>
        <button onClick={setAllPresent} className="full" style={{ flex: 1 }}>✅ Tous présents</button>
        <button onClick={onDone} className="primary full" style={{ flex: 1 }}>Terminer → Défis</button>
      </div>

      <div className="card-title" style={{ marginBottom: 10 }}>
        Appel — tap sur le statut pour changer
      </div>

      {sorted.map(e => {
        const s = students[e.studentId];
        const cfg = STATUS_CONFIG[e.status];
        return (
          <div key={e.key} className={`rollcall-item${e.status === 'ABSENT' ? ' absent' : ''}`}>
            <div style={{ fontWeight: 500 }}>
              {s ? `${s.firstName} ${s.lastName}` : e.studentId}
            </div>
            <div className="status-toggle">
              {(['PRESENT', 'ABSENT', 'DISPENSE'] as Status[]).map(st => (
                <button
                  key={st}
                  className={`status-btn${e.status === st ? ` active-${st}` : ''}`}
                  onClick={() => setStatus(e.studentId, st)}
                  title={st}
                >
                  {st === 'PRESENT' ? '✅' : st === 'ABSENT' ? '❌' : '🟡'}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
