import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db, SessionEntryRow, StudentRow, SettingsRow } from '../../../domain/services/persistence/db';
import { stableSort } from '../../../domain/rules/ranking';
import { applyMatch, applyArbitrage } from '../../../domain/rules/scoring';
import { canPlay, canReferee } from '../../../domain/rules/availability';
import { CourtMatch, PlayerEntry, suggestAllCourts } from '../../../domain/rules/courts';
import { useToast } from '../../components/Toast';

const COURT_COUNT = 7;

// ─── Composant terrain individuel ────────────────────────────────────────────

interface CourtCardProps {
  courtId: number;
  match: CourtMatch | null;
  suggestion: { player1Id: string; player2Id: string; refereeId?: string } | null;
  students: Record<string, StudentRow>;
  entries: SessionEntryRow[];
  onAccept: (courtId: number) => void;
  onSwapPlayer: (courtId: number, slot: 'player1' | 'player2' | 'referee') => void;
  onResult: (courtId: number, winnerId: string) => void;
  onCancel: (courtId: number) => void;
  dashboardMode: boolean;
}

function nameOf(id: string, students: Record<string, StudentRow>) {
  const s = students[id];
  return s ? `${s.firstName} ${s.lastName}` : id;
}

function initials(id: string, students: Record<string, StudentRow>) {
  const s = students[id];
  if (!s) return '?';
  return (s.firstName[0] ?? '') + (s.lastName[0] ?? '');
}

function rankOf(id: string, sorted: Array<{ studentId: string }>) {
  const idx = sorted.findIndex(e => e.studentId === id);
  return idx === -1 ? '?' : `#${idx + 1}`;
}

function CourtCard({ courtId, match, suggestion, students, entries, onAccept, onSwapPlayer, onResult, onCancel, dashboardMode }: CourtCardProps) {
  const sorted = useMemo(() =>
    stableSort(entries.map(e => ({ studentId: e.studentId, points: e.points, order: e.order }))),
    [entries]
  );

  const isActive = match && !match.completedAt;
  const isEmpty = !isActive && !suggestion;

  const courtColor = isActive
    ? 'var(--green)'
    : suggestion
      ? 'var(--accent)'
      : 'var(--text2)';

  const courtBg = isActive
    ? 'var(--green-light)'
    : suggestion
      ? 'var(--accent-light)'
      : 'var(--surface2)';

  return (
    <div style={{
      background: 'var(--surface)',
      border: `2px solid ${courtColor}`,
      borderRadius: 16,
      overflow: 'hidden',
      transition: 'all 0.2s'
    }}>
      {/* Header terrain */}
      <div style={{
        background: courtBg,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 800,
          fontSize: 16,
          color: courtColor
        }}>
          Terrain {courtId}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: courtColor }}>
          {isActive ? '🟢 En jeu' : suggestion ? '🟡 Suggestion' : '⚪ Libre'}
        </div>
      </div>

      <div style={{ padding: '12px 14px' }}>
        {/* ── Terrain libre, aucune suggestion ── */}
        {isEmpty && (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text2)', fontSize: 13 }}>
            En attente de joueurs…
          </div>
        )}

        {/* ── Suggestion en attente de validation ── */}
        {!isActive && suggestion && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, fontWeight: 600 }}>
              SUGGESTION
            </div>
            <PlayerSlot
              label="Joueur 1"
              playerId={suggestion.player1Id}
              students={students}
              rank={rankOf(suggestion.player1Id, sorted)}
              onSwap={dashboardMode ? undefined : () => onSwapPlayer(courtId, 'player1')}
            />
            <div style={{ textAlign: 'center', fontSize: 18, margin: '4px 0', color: 'var(--text2)' }}>VS</div>
            <PlayerSlot
              label="Joueur 2"
              playerId={suggestion.player2Id}
              students={students}
              rank={rankOf(suggestion.player2Id, sorted)}
              onSwap={dashboardMode ? undefined : () => onSwapPlayer(courtId, 'player2')}
            />
            {suggestion.refereeId && (
              <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--yellow-light)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12 }}>🦺</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{nameOf(suggestion.refereeId, students)}</span>
                {!dashboardMode && (
                  <button onClick={() => onSwapPlayer(courtId, 'referee')} style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 8px' }}>Changer</button>
                )}
              </div>
            )}
            {!dashboardMode && (
              <button className="primary full" onClick={() => onAccept(courtId)} style={{ marginTop: 12, fontSize: 14 }}>
                ✅ Valider ce match
              </button>
            )}
          </div>
        )}

        {/* ── Match en cours ── */}
        {isActive && match && (
          <div>
            <PlayerSlot
              label="Joueur 1"
              playerId={match.player1Id}
              students={students}
              rank={rankOf(match.player1Id, sorted)}
              highlight
            />
            <div style={{ textAlign: 'center', fontSize: 18, margin: '4px 0', color: 'var(--green)', fontWeight: 700 }}>VS</div>
            <PlayerSlot
              label="Joueur 2"
              playerId={match.player2Id}
              students={students}
              rank={rankOf(match.player2Id, sorted)}
              highlight
            />
            {match.refereeId && (
              <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--yellow-light)', borderRadius: 8, fontSize: 13 }}>
                🦺 {nameOf(match.refereeId, students)}
              </div>
            )}
            {!dashboardMode && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Résultat</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="primary full"
                    onClick={() => onResult(courtId, match.player1Id)}
                    style={{ fontSize: 13, padding: '10px 8px', flex: 1 }}
                  >
                    🏆 {students[match.player1Id]?.firstName ?? 'J1'}
                  </button>
                  <button
                    className="primary full"
                    onClick={() => onResult(courtId, match.player2Id)}
                    style={{ fontSize: 13, padding: '10px 8px', flex: 1 }}
                  >
                    🏆 {students[match.player2Id]?.firstName ?? 'J2'}
                  </button>
                </div>
                <button className="ghost full" onClick={() => onCancel(courtId)} style={{ fontSize: 12 }}>
                  Annuler ce terrain
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerSlot({ label, playerId, students, rank, onSwap, highlight }: {
  label: string; playerId: string; students: Record<string, StudentRow>;
  rank: string; onSwap?: () => void; highlight?: boolean;
}) {
  const s = students[playerId];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px',
      background: highlight ? 'var(--green-light)' : 'var(--surface2)',
      borderRadius: 10, marginBottom: 4
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'var(--accent-light)', color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 13, flexShrink: 0
      }}>
        {s ? (s.firstName[0] ?? '') + (s.lastName[0] ?? '') : '?'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          {s ? `${s.firstName} ${s.lastName}` : playerId}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text2)' }}>{rank}</div>
      </div>
      {onSwap && (
        <button onClick={onSwap} style={{ fontSize: 11, padding: '4px 8px', color: 'var(--text2)' }}>
          ↕ Changer
        </button>
      )}
    </div>
  );
}

// ─── Modal de sélection de joueur ────────────────────────────────────────────

function PlayerPickerModal({ title, entries, students, excludeIds, onPick, onClose }: {
  title: string;
  entries: SessionEntryRow[];
  students: Record<string, StudentRow>;
  excludeIds: string[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const available = entries.filter(e => canPlay(e.status) && !excludeIds.includes(e.studentId));
  const sorted = [...available].sort((a, b) => b.points - a.points || a.order - b.order);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map((e, idx) => {
            const s = students[e.studentId];
            return (
              <div
                key={e.studentId}
                onClick={() => { onPick(e.studentId); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', background: 'var(--surface2)',
                  borderRadius: 10, cursor: 'pointer', border: '1.5px solid var(--border)'
                }}
              >
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 12, color: 'var(--text2)', minWidth: 22 }}>
                  #{idx + 1}
                </span>
                <span style={{ flex: 1, fontWeight: 500 }}>
                  {s ? `${s.firstName} ${s.lastName}` : e.studentId}
                </span>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>{e.points.toFixed(1)}</span>
              </div>
            );
          })}
          {sorted.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text2)', padding: 20 }}>Aucun joueur disponible</div>}
        </div>
        <button className="ghost full" onClick={onClose} style={{ marginTop: 12 }}>Annuler</button>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CourtsView({ sessionId }: { sessionId: string }) {
  const [entries, setEntries] = useState<SessionEntryRow[]>([]);
  const [students, setStudents] = useState<Record<string, StudentRow>>({});
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [activeMatches, setActiveMatches] = useState<CourtMatch[]>([]);
  const [suggestions, setSuggestions] = useState<Record<number, { player1Id: string; player2Id: string; refereeId?: string }>>({});
  const [dashboardMode, setDashboardMode] = useState(false);
  const [picker, setPicker] = useState<{ courtId: number; slot: 'player1' | 'player2' | 'referee' } | null>(null);
  const [alreadyPaired, setAlreadyPaired] = useState<Set<string>>(new Set());
  const { show } = useToast();

  async function refresh() {
    const es = await db.sessionEntries.where('sessionId').equals(sessionId).toArray();
    setEntries(es);
    const ids = es.map(e => e.studentId);
    const ss = await db.students.bulkGet(ids);
    const map: Record<string, StudentRow> = {};
    ss.forEach(s => { if (s) map[s.id] = s; });
    setStudents(map);
    const sess = await db.sessions.get(sessionId);
    if (!sess) return;
    const t = await db.tournaments.get(sess.tournamentId);
    if (!t) return;
    const st = await db.settings.get(t.settingsId);
    if (st) setSettings(st);
  }

  useEffect(() => { refresh(); }, [sessionId]);

  // Calcule les suggestions dès que entries ou activeMatches changent
  useEffect(() => {
    if (!entries.length) return;
    const playerEntries: PlayerEntry[] = entries.map(e => ({
      studentId: e.studentId,
      points: e.points,
      order: e.order,
      status: e.status,
      wins: e.wins,
      losses: e.losses,
      referees: e.referees
    }));

    const newSuggestions = suggestAllCourts(COURT_COUNT, playerEntries, activeMatches);
    const map: typeof suggestions = {};
    for (const { courtId, suggestion } of newSuggestions) {
      if (suggestion) map[courtId] = suggestion;
    }
    setSuggestions(map);
  }, [entries, activeMatches]);

  // Valide une suggestion → le match démarre
  function acceptSuggestion(courtId: number) {
    const sug = suggestions[courtId];
    if (!sug) return;
    const newMatch: CourtMatch = {
      courtId,
      player1Id: sug.player1Id,
      player2Id: sug.player2Id,
      refereeId: sug.refereeId,
      suggestedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      isAuto: !sug.refereeId,
    };
    setActiveMatches(prev => [...prev.filter(m => m.courtId !== courtId), newMatch]);
    setSuggestions(prev => { const n = { ...prev }; delete n[courtId]; return n; });
  }

  // Saisit le résultat d'un match
  async function handleResult(courtId: number, winnerId: string) {
    if (!settings) return;
    const match = activeMatches.find(m => m.courtId === courtId && !m.completedAt);
    if (!match) return;
    const loserId = match.player1Id === winnerId ? match.player2Id : match.player1Id;

    // Applique les points
    const { delta, stats, winnerGain } = applyMatch(entries, settings, {
      winnerId, loserId,
      refereeId: match.refereeId,
      isAuto: match.isAuto
    });

    // Si arbitre → bonus arbitrage
    if (match.refereeId && !match.isAuto) {
      const arbResult = applyArbitrage(settings, match.refereeId);
      Object.assign(delta, arbResult.delta);
      Object.assign(stats, arbResult.stats);
    }

    // Écrit en base
    for (const [sid, d] of Object.entries(delta)) {
      const key = `${sessionId}_${sid}`;
      const current = await db.sessionEntries.get(key);
      if (!current) continue;
      const st = stats[sid] ?? {};
      await db.sessionEntries.update(key, {
        points: +(current.points + d).toFixed(2),
        wins: current.wins + (st.wins ?? 0),
        losses: current.losses + (st.losses ?? 0),
        referees: current.referees + (st.referees ?? 0),
        updatedAt: new Date().toISOString()
      });
    }

    await db.events.add({
      id: crypto.randomUUID(), sessionId,
      timestamp: new Date().toISOString(),
      type: match.isAuto ? 'MATCH_AUTO' : 'MATCH_REFEREED',
      winnerId, loserId,
      refereeId: match.refereeId,
      deltaWinner: winnerGain,
      deltaLoser: delta[loserId],
      deltaReferee: match.refereeId ? settings.arbPoints : undefined
    });

    // Marque la paire comme déjà jouée
    const pairKey = [winnerId, loserId].sort().join('_');
    setAlreadyPaired(prev => new Set([...prev, pairKey]));

    // Libère le terrain
    setActiveMatches(prev => prev.map(m =>
      m.courtId === courtId ? { ...m, winnerId, loserId, completedAt: new Date().toISOString() } : m
    ));

    const winnerName = students[winnerId];
    show(`🏆 ${winnerName ? winnerName.firstName : '?'} gagne — +${winnerGain.toFixed(1)}pts ✓`);
    await refresh();
  }

  function cancelCourt(courtId: number) {
    setActiveMatches(prev => prev.filter(m => m.courtId !== courtId));
    setSuggestions(prev => { const n = { ...prev }; delete n[courtId]; return n; });
  }

  // Swap d'un joueur dans une suggestion
  function openPicker(courtId: number, slot: 'player1' | 'player2' | 'referee') {
    setPicker({ courtId, slot });
  }

  function pickPlayer(playerId: string) {
    if (!picker) return;
    setSuggestions(prev => {
      const sug = { ...prev[picker.courtId] };
      if (picker.slot === 'player1') sug.player1Id = playerId;
      else if (picker.slot === 'player2') sug.player2Id = playerId;
      else sug.refereeId = playerId;
      return { ...prev, [picker.courtId]: sug };
    });
  }

  // Stats rapides
  const presentCount = entries.filter(e => canPlay(e.status)).length;
  const onCourtCount = activeMatches.filter(m => !m.completedAt).length * 2;
  const waitingCount = Math.max(0, presentCount - onCourtCount);

  const sorted = useMemo(() =>
    stableSort(entries.map(e => ({ studentId: e.studentId, points: e.points, order: e.order }))),
    [entries]
  );

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', gap: 12 }}>
          <span>🟢 {onCourtCount} en jeu</span>
          <span>⏳ {waitingCount} attendent</span>
        </div>
        <button
          onClick={() => setDashboardMode(d => !d)}
          style={{
            fontSize: 13, padding: '7px 12px',
            background: dashboardMode ? 'var(--text)' : 'var(--surface)',
            color: dashboardMode ? 'white' : 'var(--text)',
            borderColor: dashboardMode ? 'var(--text)' : 'var(--border)'
          }}
        >
          {dashboardMode ? '✏️ Mode saisie' : '📺 Tableau de bord'}
        </button>
      </div>

      {/* Grille terrains */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: dashboardMode ? 'repeat(2, 1fr)' : '1fr',
        gap: 12
      }}>
        {Array.from({ length: COURT_COUNT }, (_, i) => i + 1).map(courtId => {
          const match = activeMatches.find(m => m.courtId === courtId && !m.completedAt) ?? null;
          const suggestion = !match ? (suggestions[courtId] ?? null) : null;
          return (
            <CourtCard
              key={courtId}
              courtId={courtId}
              match={match}
              suggestion={suggestion}
              students={students}
              entries={entries}
              onAccept={acceptSuggestion}
              onSwapPlayer={openPicker}
              onResult={handleResult}
              onCancel={cancelCourt}
              dashboardMode={dashboardMode}
            />
          );
        })}
      </div>

      {/* Mini classement en mode dashboard */}
      {dashboardMode && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">🏆 Classement</div>
          {sorted.slice(0, 10).map((e, idx) => {
            const s = students[e.studentId];
            const entry = entries.find(x => x.studentId === e.studentId);
            const onCourt = activeMatches.some(m => !m.completedAt && (m.player1Id === e.studentId || m.player2Id === e.studentId));
            return (
              <div key={e.studentId} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: idx < 9 ? '1px solid var(--border)' : 'none',
                opacity: entry?.status === 'ABSENT' ? 0.4 : 1
              }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 13, minWidth: 24, color: 'var(--text2)' }}>
                  {idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}
                </span>
                <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>
                  {s ? `${s.firstName} ${s.lastName}` : e.studentId}
                </span>
                {onCourt && <span style={{ fontSize: 11, background: 'var(--green-light)', color: 'var(--green)', padding: '2px 7px', borderRadius: 999, fontWeight: 700 }}>En jeu</span>}
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800 }}>{e.points.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal sélection joueur */}
      {picker && (
        <PlayerPickerModal
          title={picker.slot === 'referee' ? 'Choisir l\'arbitre' : `Choisir le joueur (${picker.slot === 'player1' ? 'J1' : 'J2'})`}
          entries={entries}
          students={students}
          excludeIds={(() => {
            const sug = suggestions[picker.courtId];
            if (!sug) return [];
            const ids = [sug.player1Id, sug.player2Id];
            if (sug.refereeId) ids.push(sug.refereeId);
            return ids.filter((_, i) => {
              if (picker.slot === 'player1') return i !== 0;
              if (picker.slot === 'player2') return i !== 1;
              return i !== 2;
            });
          })()}
          onPick={pickPlayer}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
