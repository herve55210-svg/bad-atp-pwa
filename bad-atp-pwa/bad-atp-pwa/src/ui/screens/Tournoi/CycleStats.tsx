import React, { useEffect, useMemo, useState } from 'react';
import {
  db, SessionRow, SessionEntryRow, StudentRow, EventRow
} from '../../../domain/services/persistence/db';
import { buildIdoceoCsv } from '../../../domain/utils/idoceo';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionStat {
  session: SessionRow;
  entries: SessionEntryRow[];
  matchCount: number;   // matches joués dans la séance (gagnés + perdus)
  arbCount: number;     // arbitrages dans la séance
}

interface StudentCycleStat {
  studentId: string;
  name: string;
  // cumulés sur tout le cycle
  totalWins: number;
  totalLosses: number;
  totalReferees: number;
  totalMatches: number;
  sessionsPlayed: number;
  // points de la dernière séance
  lastPoints: number;
  // progression séance par séance [{sessionLabel, wins, losses, refs, pts}]
  bySession: Array<{
    sessionId: string;
    label: string;
    status: string;
    wins: number;
    losses: number;
    referees: number;
    points: number;
    rank: number;       // rang dans cette séance
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(wins: number, losses: number) {
  const total = wins + losses;
  if (!total) return '—';
  return Math.round((wins / total) * 100) + '%';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Sous-composant : ligne élève dans la vue détaillée ──────────────────────

function StudentStatRow({
  stat, sessions
}: { stat: StudentCycleStat; sessions: SessionRow[] }) {
  const [expanded, setExpanded] = useState(false);

  const winRate = parseInt(pct(stat.totalWins, stat.totalLosses));
  const rateColor = isNaN(winRate)
    ? 'var(--text2)'
    : winRate >= 60 ? 'var(--green)' : winRate >= 40 ? 'var(--yellow)' : 'var(--red)';

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Ligne principale */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
          background: 'var(--surface)',
          border: `1.5px solid ${expanded ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: expanded ? '12px 12px 0 0' : 12,
          cursor: 'pointer', transition: 'all 0.15s'
        }}
      >
        <span style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{stat.name}</span>
        <span style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span title="Matches joués">🏸 {stat.totalMatches}</span>
          <span title="Victoires" style={{ color: 'var(--green)' }}>🏆 {stat.totalWins}</span>
          <span title="Défaites" style={{ color: 'var(--red)' }}>💔 {stat.totalLosses}</span>
          <span title="Arbitrages">🦺 {stat.totalReferees}</span>
          <span title="% victoires" style={{ color: rateColor, fontWeight: 700 }}>
            {pct(stat.totalWins, stat.totalLosses)}
          </span>
        </span>
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, minWidth: 40, textAlign: 'right' }}>
          {stat.lastPoints.toFixed(1)}
        </span>
        <span style={{ color: 'var(--text2)', fontSize: 16, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none' }}>›</span>
      </div>

      {/* Détail séance par séance */}
      {expanded && (
        <div style={{
          border: '1.5px solid var(--accent)',
          borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          background: 'var(--surface2)',
          overflow: 'hidden'
        }}>
          {/* En-tête colonnes */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 44px 44px 44px 44px 50px 40px',
            padding: '8px 14px',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text2)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: '1px solid var(--border)'
          }}>
            <span>Séance</span>
            <span style={{ textAlign: 'center' }}>🏸</span>
            <span style={{ textAlign: 'center' }}>🏆</span>
            <span style={{ textAlign: 'center' }}>💔</span>
            <span style={{ textAlign: 'center' }}>🦺</span>
            <span style={{ textAlign: 'right' }}>Pts</span>
            <span style={{ textAlign: 'right' }}>Rang</span>
          </div>

          {stat.bySession.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text2)' }}>
              Absent(e) à toutes les séances.
            </div>
          ) : (
            stat.bySession.map((bs, i) => {
              const isAbsent = bs.status === 'ABSENT';
              const isDispense = bs.status === 'DISPENSE';
              return (
                <div
                  key={bs.sessionId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 44px 44px 44px 44px 50px 40px',
                    padding: '10px 14px',
                    fontSize: 13,
                    borderBottom: i < stat.bySession.length - 1 ? '1px solid var(--border)' : 'none',
                    opacity: isAbsent ? 0.45 : 1,
                    background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'
                  }}
                >
                  <span style={{ fontWeight: 500 }}>
                    {bs.label}
                    {isAbsent && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--red)', background: 'var(--red-light)', padding: '1px 6px', borderRadius: 999 }}>ABS</span>}
                    {isDispense && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--yellow)', background: 'var(--yellow-light)', padding: '1px 6px', borderRadius: 999 }}>DISP</span>}
                  </span>
                  <span style={{ textAlign: 'center', color: 'var(--text2)' }}>{bs.wins + bs.losses || '—'}</span>
                  <span style={{ textAlign: 'center', color: bs.wins ? 'var(--green)' : 'var(--text2)', fontWeight: bs.wins ? 700 : 400 }}>{bs.wins || '—'}</span>
                  <span style={{ textAlign: 'center', color: bs.losses ? 'var(--red)' : 'var(--text2)' }}>{bs.losses || '—'}</span>
                  <span style={{ textAlign: 'center', color: bs.referees ? 'var(--yellow)' : 'var(--text2)' }}>{bs.referees || '—'}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>{bs.points.toFixed(1)}</span>
                  <span style={{ textAlign: 'right', color: bs.rank <= 3 ? 'var(--accent)' : 'var(--text2)', fontWeight: bs.rank <= 3 ? 700 : 400 }}>
                    {isAbsent ? '—' : `#${bs.rank}`}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CycleStats({ tournamentId }: { tournamentId: string }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [allEntries, setAllEntries] = useState<SessionEntryRow[]>([]);
  const [students, setStudents] = useState<Record<string, StudentRow>>({});
  const [allEvents, setAllEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'cycle' | 'sessions'>('cycle');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const sess = await db.sessions.where('tournamentId').equals(tournamentId).sortBy('date');
      setSessions(sess);

      const entries: SessionEntryRow[] = [];
      const events: EventRow[] = [];
      for (const s of sess) {
        entries.push(...await db.sessionEntries.where('sessionId').equals(s.id).toArray());
        events.push(...await db.events.where('sessionId').equals(s.id).toArray());
      }
      setAllEntries(entries);
      setAllEvents(events);

      const t = await db.tournaments.get(tournamentId);
      if (t) {
        const studs = await db.students.where('classId').equals(t.classId).toArray();
        const map: Record<string, StudentRow> = {};
        studs.forEach(s => { map[s.id] = s; });
        setStudents(map);
      }
      setLoading(false);
    }
    load();
  }, [tournamentId]);

  // Stats séance par séance (pour la vue "Séances")
  const sessionStats = useMemo<SessionStat[]>(() => {
    return sessions.map(sess => {
      const entries = allEntries.filter(e => e.sessionId === sess.id);
      const events = allEvents.filter(e => e.sessionId === sess.id);
      const matchCount = events.filter(e => e.type === 'MATCH_AUTO' || e.type === 'MATCH_REFEREED').length;
      const arbCount = events.filter(e => e.type === 'ARBITRAGE').length;
      return { session: sess, entries, matchCount, arbCount };
    });
  }, [sessions, allEntries, allEvents]);

  // Stats cycle par élève (pour la vue "Élèves")
  const studentStats = useMemo<StudentCycleStat[]>(() => {
    if (!sessions.length) return [];

    // Rang par séance : trier les entries de chaque séance par points
    const rankBySess: Record<string, Record<string, number>> = {};
    for (const sess of sessions) {
      const sessEntries = allEntries
        .filter(e => e.sessionId === sess.id)
        .sort((a, b) => b.points - a.points || a.order - b.order);
      rankBySess[sess.id] = {};
      sessEntries.forEach((e, i) => { rankBySess[sess.id][e.studentId] = i + 1; });
    }

    const map = new Map<string, StudentCycleStat>();

    for (const s of Object.values(students)) {
      const sessData: StudentCycleStat['bySession'] = [];
      let totalWins = 0, totalLosses = 0, totalRefs = 0, sessPlayed = 0, lastPts = 0;

      for (const sess of sessions) {
        const entry = allEntries.find(e => e.sessionId === sess.id && e.studentId === s.id);
        if (!entry) continue;
        const label = fmtDate(sess.date);
        const rank = rankBySess[sess.id]?.[s.id] ?? 0;
        sessData.push({
          sessionId: sess.id, label, status: entry.status,
          wins: entry.wins, losses: entry.losses, referees: entry.referees,
          points: entry.points, rank
        });
        if (entry.status !== 'ABSENT') {
          totalWins += entry.wins;
          totalLosses += entry.losses;
          totalRefs += entry.referees;
          sessPlayed++;
          lastPts = entry.points;
        }
      }

      map.set(s.id, {
        studentId: s.id,
        name: `${s.firstName} ${s.lastName}`,
        totalWins, totalLosses, totalReferees: totalRefs,
        totalMatches: totalWins + totalLosses,
        sessionsPlayed: sessPlayed,
        lastPoints: lastPts,
        bySession: sessData
      });
    }

    return [...map.values()].sort((a, b) => b.lastPoints - a.lastPoints);
  }, [sessions, allEntries, students]);

  // Totaux cycle
  const totalMatches = useMemo(() =>
    allEvents.filter(e => e.type === 'MATCH_AUTO' || e.type === 'MATCH_REFEREED').length, [allEvents]);
  const totalArbs = useMemo(() =>
    allEvents.filter(e => e.type === 'ARBITRAGE').length, [allEvents]);

  // Export CSV complet (format interne)
  function exportCsvComplet() {
    const rows: string[] = [];
    const sessLabels = sessions.map(s => fmtDate(s.date));
    rows.push(['Élève', 'Total matchs', 'Victoires', 'Défaites', 'Arbitrages', '% V', 'Séances', ...sessLabels.flatMap(l => [`${l} - Pts`, `${l} - V`, `${l} - D`, `${l} - Arb`])].join(';'));
    for (const stat of studentStats) {
      const sessValues = sessions.flatMap(sess => {
        const bs = stat.bySession.find(b => b.sessionId === sess.id);
        if (!bs || bs.status === 'ABSENT') return ['ABS', '', '', ''];
        return [bs.points.toFixed(1), bs.wins, bs.losses, bs.referees];
      });
      rows.push([stat.name, stat.totalMatches, stat.totalWins, stat.totalLosses, stat.totalReferees, pct(stat.totalWins, stat.totalLosses), stat.sessionsPlayed, ...sessValues].join(';'));
    }
    triggerDownload(rows.join('\n'), 'historique-cycle.csv');
  }

  // Export iDocéo — une colonne par séance (Points, V, D, Arb)
  function exportIdoceo() {
    const studs = studentStats.map(st => {
      const parts = st.name.split(' ');
      return { studentId: st.studentId, firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
    });

    const columns = sessions.flatMap(sess => {
      const label = fmtDate(sess.date);
      return [
        {
          header: `Badminton ${label} - Pts`,
          getValue: (sid: string) => {
            const stat = studentStats.find(s => s.studentId === sid);
            const bs = stat?.bySession.find(b => b.sessionId === sess.id);
            if (!bs || bs.status === 'ABSENT') return 'ABS';
            return bs.points.toFixed(1);
          }
        },
        {
          header: `Badminton ${label} - V`,
          getValue: (sid: string) => {
            const stat = studentStats.find(s => s.studentId === sid);
            const bs = stat?.bySession.find(b => b.sessionId === sess.id);
            if (!bs || bs.status === 'ABSENT') return '';
            return String(bs.wins);
          }
        },
        {
          header: `Badminton ${label} - D`,
          getValue: (sid: string) => {
            const stat = studentStats.find(s => s.studentId === sid);
            const bs = stat?.bySession.find(b => b.sessionId === sess.id);
            if (!bs || bs.status === 'ABSENT') return '';
            return String(bs.losses);
          }
        },
        {
          header: `Badminton ${label} - Arb`,
          getValue: (sid: string) => {
            const stat = studentStats.find(s => s.studentId === sid);
            const bs = stat?.bySession.find(b => b.sessionId === sess.id);
            if (!bs || bs.status === 'ABSENT') return '';
            return String(bs.referees);
          }
        },
      ];
    });

    const csv = buildIdoceoCsv(studs, columns);
    triggerDownload(csv, 'idoceo-badminton.csv');
  }

  function triggerDownload(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (loading) return (
    <div className="empty"><div className="empty-icon">⏳</div><p>Chargement…</p></div>
  );

  if (!sessions.length) return (
    <div className="empty"><div className="empty-icon">📊</div><p>Aucune séance dans ce cycle.</p></div>
  );

  return (
    <div>
      {/* Résumé global */}
      <div className="summary-bar">
        <div className="summary-pill" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
          <span className="num">{sessions.length}</span>Séances
        </div>
        <div className="summary-pill" style={{ background: 'var(--green-light)', color: 'var(--green)' }}>
          <span className="num">{totalMatches}</span>Matches
        </div>
        <div className="summary-pill" style={{ background: 'var(--yellow-light)', color: 'var(--yellow)' }}>
          <span className="num">{totalArbs}</span>Arbitrages
        </div>
      </div>

      {/* Toggle vue */}
      <div className="mode-toggle" style={{ marginBottom: 14 }}>
        <button className={`mode-btn${view === 'cycle' ? ' active' : ''}`} onClick={() => setView('cycle')}>
          👥 Par élève
        </button>
        <button className={`mode-btn${view === 'sessions' ? ' active' : ''}`} onClick={() => setView('sessions')}>
          📅 Par séance
        </button>
      </div>

      {/* Exports */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          onClick={exportIdoceo}
          style={{ fontSize: 13, padding: '7px 12px', background: 'var(--accent-light)', borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 }}
        >
          📲 Export iDocéo
        </button>
        <button onClick={exportCsvComplet} style={{ fontSize: 13, padding: '7px 12px' }}>
          📤 Export CSV complet
        </button>
      </div>

      {/* ── VUE PAR ÉLÈVE ─────────────────────────────────────────── */}
      {view === 'cycle' && (
        <div>
          <div className="small" style={{ marginBottom: 10 }}>
            Tap sur un élève pour voir son détail séance par séance.
          </div>
          {studentStats.map((stat, idx) => (
            <div key={stat.studentId} style={{ position: 'relative' }}>
              {/* Rang */}
              <div style={{
                position: 'absolute', left: -24, top: 13,
                fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 12,
                color: idx === 0 ? '#C9A800' : idx === 1 ? '#888' : idx === 2 ? '#A0522D' : 'var(--text2)'
              }}>
                {idx < 3 ? ['🥇','🥈','🥉'][idx] : `${idx + 1}`}
              </div>
              <StudentStatRow stat={stat} sessions={sessions} />
            </div>
          ))}
        </div>
      )}

      {/* ── VUE PAR SÉANCE ────────────────────────────────────────── */}
      {view === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sessionStats.map(({ session, entries, matchCount, arbCount }) => {
            // Tri par points pour le podium
            const sorted = [...entries].sort((a, b) => b.points - a.points || a.order - b.order);
            const presentCount = entries.filter(e => e.status === 'PRESENT').length;
            const absentCount = entries.filter(e => e.status === 'ABSENT').length;
            const dispenseCount = entries.filter(e => e.status === 'DISPENSE').length;

            return (
              <div key={session.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header séance */}
                <div style={{
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, var(--accent-light), var(--surface))',
                  borderBottom: '1px solid var(--border)'
                }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16 }}>
                    {fmtDate(session.date)}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 12, color: 'var(--text2)', flexWrap: 'wrap' }}>
                    <span>🏸 {matchCount} match{matchCount > 1 ? 's' : ''}</span>
                    <span>🦺 {arbCount} arbitrage{arbCount > 1 ? 's' : ''}</span>
                    <span style={{ color: 'var(--green)' }}>✅ {presentCount} présent{presentCount > 1 ? 's' : ''}</span>
                    {absentCount > 0 && <span style={{ color: 'var(--red)' }}>❌ {absentCount} absent{absentCount > 1 ? 's' : ''}</span>}
                    {dispenseCount > 0 && <span style={{ color: 'var(--yellow)' }}>🟡 {dispenseCount} dispensé{dispenseCount > 1 ? 's' : ''}</span>}
                  </div>
                </div>

                {/* Tableau élèves */}
                <div>
                  {/* En-tête */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr 44px 44px 44px 44px 50px',
                    padding: '8px 14px',
                    fontSize: 11, fontWeight: 700,
                    color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)'
                  }}>
                    <span>#</span>
                    <span>Élève</span>
                    <span style={{ textAlign: 'center' }}>🏸</span>
                    <span style={{ textAlign: 'center' }}>🏆</span>
                    <span style={{ textAlign: 'center' }}>💔</span>
                    <span style={{ textAlign: 'center' }}>🦺</span>
                    <span style={{ textAlign: 'right' }}>Pts</span>
                  </div>

                  {sorted.map((entry, rank) => {
                    const s = students[entry.studentId];
                    const name = s ? `${s.firstName} ${s.lastName}` : entry.studentId;
                    const isAbsent = entry.status === 'ABSENT';
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <div
                        key={entry.key}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '28px 1fr 44px 44px 44px 44px 50px',
                          padding: '10px 14px',
                          fontSize: 14,
                          borderBottom: rank < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                          opacity: isAbsent ? 0.4 : 1,
                          background: rank % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{
                          fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 12,
                          color: rank === 0 ? '#C9A800' : rank === 1 ? '#888' : rank === 2 ? '#A0522D' : 'var(--text2)'
                        }}>
                          {rank < 3 ? medals[rank] : rank + 1}
                        </span>
                        <span style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {name}
                          {entry.status === 'DISPENSE' && (
                            <span style={{ marginLeft: 5, fontSize: 10, color: 'var(--yellow)', background: 'var(--yellow-light)', padding: '1px 5px', borderRadius: 999 }}>D</span>
                          )}
                        </span>
                        <span style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 13 }}>{entry.wins + entry.losses || '—'}</span>
                        <span style={{ textAlign: 'center', color: entry.wins ? 'var(--green)' : 'var(--text2)', fontWeight: entry.wins ? 700 : 400, fontSize: 13 }}>
                          {entry.wins || '—'}
                        </span>
                        <span style={{ textAlign: 'center', color: entry.losses ? 'var(--red)' : 'var(--text2)', fontSize: 13 }}>
                          {entry.losses || '—'}
                        </span>
                        <span style={{ textAlign: 'center', color: entry.referees ? 'var(--yellow)' : 'var(--text2)', fontSize: 13 }}>
                          {entry.referees || '—'}
                        </span>
                        <span style={{ textAlign: 'right', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15 }}>
                          {entry.points.toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
