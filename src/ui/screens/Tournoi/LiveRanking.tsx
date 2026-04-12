import React, { useEffect, useMemo, useState } from 'react';
import { db, SessionEntryRow, StudentRow, SettingsRow, EventRow } from '../../../domain/services/persistence/db';
import { stableSort, getChallengeCandidates } from '../../../domain/rules/ranking';
import { applyArbitrage, applyMatch } from '../../../domain/rules/scoring';
import { canPlay, canReferee } from '../../../domain/rules/availability';
import { useToast } from '../../components/Toast';

const RANK_MEDAL = ['🥇', '🥈', '🥉'];

// Snapshot pris avant chaque action pour permettre le undo
type Snapshot = {
  eventId: string;
  label: string;
  entries: Array<{ key: string; points: number; wins: number; losses: number; referees: number }>;
};

export default function LiveRanking({ sessionId }: { sessionId: string }) {
  const [entries, setEntries] = useState<SessionEntryRow[]>([]);
  const [students, setStudents] = useState<Record<string, StudentRow>>({});
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [loserId, setLoserId] = useState<string>('');
  const [refereeId, setRefereeId] = useState<string>('');
  const [isAuto, setIsAuto] = useState<boolean>(true);
  const [showHistory, setShowHistory] = useState(false);
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
    setSettings(st ?? null);
    const evs = await db.events.where('sessionId').equals(sessionId).sortBy('timestamp');
    setEvents(evs.reverse());
  }

  useEffect(() => { refresh(); }, [sessionId]);

  const sorted = useMemo(() =>
    stableSort(entries.map(e => ({ studentId: e.studentId, points: e.points, order: e.order, status: e.status }))),
    [entries]
  );

  const selectedEntry = useMemo(() =>
    selectedStudentId ? entries.find(e => e.studentId === selectedStudentId) ?? null : null,
    [selectedStudentId, entries]
  );

  const presentIds = useMemo(() => entries.filter(e => canPlay(e.status)).map(e => e.studentId), [entries]);
  const refereeEligibleIds = useMemo(() => entries.filter(e => canReferee(e.status)).map(e => e.studentId), [entries]);

  useEffect(() => { setLoserId(''); setRefereeId(''); setIsAuto(true); }, [selectedStudentId]);

  function nameOf(id: string) {
    const s = students[id];
    return s ? `${s.firstName} ${s.lastName}` : id;
  }

  // Prend un snapshot des entrées actuelles avant d'appliquer une action
  function takeSnapshot(label: string, eventId: string): Snapshot {
    return {
      eventId,
      label,
      entries: entries.map(e => ({ key: e.key, points: e.points, wins: e.wins, losses: e.losses, referees: e.referees }))
    };
  }

  async function applyDelta(
    delta: Record<string, number>,
    stats: Record<string, { wins?: number; losses?: number; referees?: number }>,
    eventData: Omit<EventRow, 'id' | 'sessionId' | 'timestamp'>,
    snapshotLabel: string
  ) {
    const eventId = crypto.randomUUID();
    const snapshot = takeSnapshot(snapshotLabel, eventId);

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
      id: eventId,
      sessionId,
      timestamp: new Date().toISOString(),
      ...eventData
    });

    setUndoStack(prev => [...prev, snapshot]);
    await refresh();
  }

  async function undo() {
    const snapshot = undoStack[undoStack.length - 1];
    if (!snapshot) return;

    // Restaurer les points
    for (const snap of snapshot.entries) {
      await db.sessionEntries.update(snap.key, {
        points: snap.points,
        wins: snap.wins,
        losses: snap.losses,
        referees: snap.referees,
        updatedAt: new Date().toISOString()
      });
    }
    // Supprimer l'event
    await db.events.delete(snapshot.eventId);

    setUndoStack(prev => prev.slice(0, -1));
    await refresh();
    show(`↩ Annulé : ${snapshot.label}`);
  }

  async function doArbitrage(studentId: string) {
    if (!settings) return;
    const e = entries.find(x => x.studentId === studentId);
    if (!e) return;
    if (!canReferee(e.status)) { show('Cet élève est absent — il ne peut pas arbitrer.'); return; }
    const { delta, stats } = applyArbitrage(settings, studentId);
    await applyDelta(delta, stats, { type: 'ARBITRAGE', refereeId: studentId, deltaReferee: settings.arbPoints }, `Arbitrage ${nameOf(studentId)}`);
    show(`🦺 Arbitrage +${settings.arbPoints}pts — ${nameOf(studentId)} ✓`);
  }

  async function submitMatch() {
    if (!settings || !selectedStudentId || !selectedEntry) return;
    if (!canPlay(selectedEntry.status)) { show('Le vainqueur doit être PRÉSENT.'); return; }
    if (!loserId) { show('Choisis un perdant.'); return; }
    if (!presentIds.includes(loserId)) { show('Le perdant doit être PRÉSENT.'); return; }
    if (loserId === selectedStudentId) { show('Vainqueur = perdant ?!'); return; }

    let ref: string | undefined;
    if (!isAuto) {
      if (!refereeId) { show('Choisis un arbitre.'); return; }
      if (!refereeEligibleIds.includes(refereeId)) { show('Arbitre invalide (absent).'); return; }
      ref = refereeId;
    }

    const { delta, stats, winnerGain } = applyMatch(entries, settings, {
      winnerId: selectedStudentId, loserId, refereeId: ref, isAuto
    });

    const loserGain = delta[loserId] ?? 0;
    const label = `${nameOf(selectedStudentId)} bat ${nameOf(loserId)}`;

    await applyDelta(delta, stats, {
      type: isAuto ? 'MATCH_AUTO' : 'MATCH_REFEREED',
      winnerId: selectedStudentId,
      loserId,
      refereeId: ref,
      deltaWinner: winnerGain,
      deltaLoser: loserGain,
      deltaReferee: ref ? settings.arbPoints : undefined
    }, label);

    show(`🏸 ${label} — +${winnerGain.toFixed(1)}pts ✓`);
    setSelectedStudentId(null);
  }

  const challengeCandidates = useMemo(() => {
    if (!selectedStudentId || !settings) return [];
    return getChallengeCandidates(selectedStudentId, sorted, settings.maxChallengeDisplay);
  }, [selectedStudentId, sorted, settings]);

  // Format d'un event pour l'historique
  function formatEvent(ev: EventRow): string {
    const time = new Date(ev.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (ev.type === 'ARBITRAGE') {
      return `${time} 🦺 Arbitrage — ${nameOf(ev.refereeId ?? '')} (+${ev.deltaReferee}pts)`;
    }
    if (ev.type === 'MATCH_AUTO' || ev.type === 'MATCH_REFEREED') {
      const auto = ev.type === 'MATCH_AUTO' ? '(auto)' : '(arbitré)';
      let line = `${time} 🏸 ${nameOf(ev.winnerId ?? '')} bat ${nameOf(ev.loserId ?? '')} ${auto} · +${(ev.deltaWinner ?? 0).toFixed(1)}`;
      if (ev.refereeId) line += ` · arb. ${nameOf(ev.refereeId)}`;
      return line;
    }
    return `${time} — ${ev.type}`;
  }

  return (
    <div>
      {/* Toolbar: undo + historique */}
      <div className="row-between" style={{ marginBottom: 12 }}>
        <div className="small" style={{ color: 'var(--text2)' }}>Tap → saisir un match</div>
        <div className="row" style={{ gap: 8 }}>
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            style={{ fontSize: 14, padding: '8px 12px', opacity: undoStack.length === 0 ? 0.4 : 1 }}
          >
            ↩ Annuler
          </button>
          <button
            onClick={() => setShowHistory(h => !h)}
            style={{ fontSize: 14, padding: '8px 12px', background: showHistory ? 'var(--accent-light)' : undefined, borderColor: showHistory ? 'var(--accent)' : undefined }}
          >
            📋 {events.length}
          </button>
        </div>
      </div>

      {/* Historique de la séance */}
      {showHistory && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-title">Historique de la séance</div>
          {events.length === 0 ? (
            <div className="small">Aucune action enregistrée.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {events.map(ev => (
                <div key={ev.id} className="small" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  {formatEvent(ev)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ranking list */}
      <ul className="rank-list">
        {sorted.map((e, idx) => {
          const s = students[e.studentId];
          const full = entries.find(x => x.studentId === e.studentId);
          const isSelected = selectedStudentId === e.studentId;
          const rankClass = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : '';
          const isAbsent = full?.status === 'ABSENT';

          return (
            <li key={e.studentId}>
              <div
                className={`rank-row${isSelected ? ' selected' : ''}${isAbsent ? ' absent' : ''}`}
                onClick={() => setSelectedStudentId(isSelected ? null : e.studentId)}
              >
                <span className={`rank-num ${rankClass}`}>
                  {idx < 3 ? RANK_MEDAL[idx] : `${idx + 1}`}
                </span>
                <span className="rank-name">
                  {s ? `${s.firstName} ${s.lastName}` : e.studentId}
                </span>
                <span className="rank-stats">
                  <span title="Victoires">🏆{full?.wins ?? 0}</span>
                  <span title="Défaites">💔{full?.losses ?? 0}</span>
                  <span title="Arbitrages">🦺{full?.referees ?? 0}</span>
                </span>
                <span className="rank-pts">{e.points.toFixed(1)}</span>
                <span className={`badge badge-${full?.status ?? 'PRESENT'}`} style={{ fontSize: 10 }}>
                  {full?.status === 'PRESENT' ? 'P' : full?.status === 'ABSENT' ? 'A' : 'D'}
                </span>
              </div>

              {/* Expanded match panel */}
              {isSelected && selectedEntry && (
                <div className="match-panel">
                  <div className="match-panel-title">
                    {s ? `${s.firstName} ${s.lastName}` : 'Élève'} — Action
                  </div>

                  <button
                    className="full"
                    style={{ marginBottom: 12 }}
                    onClick={() => doArbitrage(e.studentId)}
                    disabled={!canReferee(selectedEntry.status)}
                  >
                    🦺 Arbitrage (+{settings?.arbPoints ?? 0.5}pts)
                  </button>

                  <hr className="divider" />

                  <div className="mode-toggle">
                    <button className={`mode-btn${isAuto ? ' active' : ''}`} onClick={() => setIsAuto(true)}>
                      Auto-arbitré
                    </button>
                    <button className={`mode-btn${!isAuto ? ' active' : ''}`} onClick={() => setIsAuto(false)}>
                      Arbitré
                    </button>
                  </div>

                  <div className="field">
                    <label>Perdant (PRÉSENT)</label>
                    <select value={loserId} onChange={ev => setLoserId(ev.target.value)}>
                      <option value="">— Choisir le perdant —</option>
                      {presentIds.filter(id => id !== e.studentId).map(id => (
                        <option key={id} value={id}>{nameOf(id)}</option>
                      ))}
                    </select>
                  </div>

                  {!isAuto && (
                    <div className="field">
                      <label>Arbitre (PRÉSENT ou DISPENSÉ)</label>
                      <select value={refereeId} onChange={ev => setRefereeId(ev.target.value)}>
                        <option value="">— Choisir l'arbitre —</option>
                        {refereeEligibleIds.filter(id => id !== e.studentId && id !== loserId).map(id => (
                          <option key={id} value={id}>{nameOf(id)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {challengeCandidates.length > 0 && (
                    <div className="small" style={{ marginBottom: 12 }}>
                      🎯 Peut défier : {challengeCandidates.map(id => nameOf(id)).join(', ')}
                    </div>
                  )}

                  <button className="primary full" onClick={submitMatch} disabled={!loserId}>
                    ✅ Valider le match
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {sorted.length === 0 && (
        <div className="empty">
          <div className="empty-icon">📋</div>
          <p>Fais l'appel d'abord pour voir le classement.</p>
        </div>
      )}
    </div>
  );
}
