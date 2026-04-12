import React, { useEffect, useMemo, useState } from 'react';
import { db, SessionRow } from '../../../domain/services/persistence/db';
import { createSessionForToday } from './helpers';
import QuickRollCall from './QuickRollCall';
import LiveRanking from './LiveRanking';
import CycleStats from './CycleStats';
import CourtsView from './CourtsView';

type Mode = 'rollcall' | 'courts' | 'live' | 'stats';

const TABS: Array<{ key: Mode; label: string; noSession?: boolean }> = [
  { key: 'rollcall', label: '📋 Appel' },
  { key: 'courts',   label: '🏸 Terrains' },
  { key: 'live',     label: '📊 Classement' },
  { key: 'stats',    label: '🏆 Cycle',  noSession: true },
];

export default function TournamentPlay({ tournamentId }: { tournamentId: string }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('courts');

  async function refresh() {
    const ss = await db.sessions.where('tournamentId').equals(tournamentId).sortBy('date');
    setSessions(ss.reverse());
  }

  useEffect(() => { refresh(); }, [tournamentId]);

  async function newSession() {
    const id = await createSessionForToday(tournamentId);
    setCurrentSessionId(id);
    setMode('rollcall');
    await refresh();
  }

  return (
    <div>
      {/* Sélecteur de séance */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div className="card-title" style={{ margin: 0 }}>Séances</div>
          <button className="primary" onClick={newSession}>+ Séance</button>
        </div>

        {sessions.length > 0 ? (
          <select
            value={currentSessionId ?? ''}
            onChange={e => { setCurrentSessionId(e.target.value); setMode('courts'); }}
            style={{ marginBottom: 10 }}
          >
            <option value="" disabled>Choisir une séance…</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        ) : (
          <div className="small">Aucune séance. Lance "+ Séance" pour commencer.</div>
        )}

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 10, padding: 3 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setMode(t.key)}
              disabled={!t.noSession && !currentSessionId}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none',
                fontSize: 12, fontWeight: 600,
                background: mode === t.key ? 'white' : 'transparent',
                color: mode === t.key ? 'var(--text)' : 'var(--text2)',
                boxShadow: mode === t.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                opacity: (!t.noSession && !currentSessionId) ? 0.4 : 1,
                transition: 'all 0.15s'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      {mode === 'rollcall' && currentSessionId && (
        <QuickRollCall sessionId={currentSessionId} onDone={() => setMode('courts')} />
      )}

      {mode === 'courts' && currentSessionId && (
        <CourtsView sessionId={currentSessionId} />
      )}

      {mode === 'live' && currentSessionId && (
        <LiveRanking sessionId={currentSessionId} />
      )}

      {mode === 'stats' && (
        <CycleStats tournamentId={tournamentId} />
      )}

      {!currentSessionId && mode !== 'stats' && (
        <div className="empty" style={{ padding: '24px 16px' }}>
          <p>Sélectionne une séance ou crée-en une nouvelle.</p>
        </div>
      )}
    </div>
  );
}
