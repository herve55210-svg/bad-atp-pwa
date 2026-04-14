import React, { useEffect, useState } from 'react';
import { db, ClassRow, TournamentRow } from '../../../domain/services/persistence/db';
import TournamentPlay from './TournamentPlay';
import { InputModal, ConfirmModal } from '../../components/Modal';
import { useToast } from '../../components/Toast';

const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

export default function Tournoi() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>('');
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TournamentRow | null>(null);
  const { show } = useToast();

  async function refreshClasses() {
    const cs = await db.classes.orderBy('name').toArray();
    setClasses(cs);
    if (!classId && cs.length) setClassId(cs[0].id);
  }

  async function refreshTournaments(cid: string) {
    const ts = await db.tournaments.where('classId').equals(cid).toArray();
    setTournaments(ts.reverse());
  }

  useEffect(() => { refreshClasses(); }, []);
  useEffect(() => { if (classId) refreshTournaments(classId); }, [classId]);

  async function addTournament(name: string) {
    if (!classId) return;
    const settings = await db.settings.toCollection().first();
    if (!settings) return show('Parametres introuvables.');
    await db.tournaments.add({
      id: uuid(), classId, name, settingsId: settings.id,
      createdAt: nowIso(), updatedAt: nowIso()
    });
    await refreshTournaments(classId);
    show('Cycle cree');
  }

  async function deleteTournament(t: TournamentRow) {
    const sessions = await db.sessions.where('tournamentId').equals(t.id).toArray();
    for (const s of sessions) {
      await db.sessionEntries.where('sessionId').equals(s.id).delete();
      await db.events.where('sessionId').equals(s.id).delete();
    }
    await db.sessions.where('tournamentId').equals(t.id).delete();
    await db.tournaments.delete(t.id);
    await refreshTournaments(classId);
    show('Cycle supprime');
  }

  if (selectedTournamentId) {
    const t = tournaments.find(x => x.id === selectedTournamentId);
    return (
      <div>
        <div className="page-header">
          <button className="ghost" onClick={() => setSelectedTournamentId(null)} style={{ padding: '8px 0', fontSize: 20 }}>{'<-'}</button>
          <h1 className="page-title" style={{ flex: 1, fontSize: 22 }}>{t?.name ?? 'Tournoi'}</h1>
        </div>
        <TournamentPlay tournamentId={selectedTournamentId} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tournoi</h1>
        <button className="primary" onClick={() => setShowAddModal(true)} disabled={!classId}>+ Cycle</button>
      </div>
      <p className="page-subtitle">Selectionne une classe puis un cycle</p>
      {classes.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🏫</div>
          <p>Aucune classe.</p>
        </div>
      ) : (
        <>
          <div className="chip-list">
            {classes.map(c => (
              <div key={c.id} className={'chip' + (classId === c.id ? ' active' : '')} onClick={() => setClassId(c.id)}>
                {c.name}
              </div>
            ))}
          </div>
          {tournaments.length === 0 ? (
            <div className="empty" style={{ padding: '32px 16px' }}>
              <div className="empty-icon">🏆</div>
              <p>Aucun cycle.</p>
            </div>
          ) : (
            tournaments.map(t => (
              <div key={t.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17 }}>{t.name}</div>
                  <div className="small">{new Date(t.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
                <button className="ghost" style={{ fontSize: 18, padding: '8px 10px', color: '#C0392B' }} onClick={() => setDeleteTarget(t)}>🗑</button>
                <button className="primary" onClick={() => setSelectedTournamentId(t.id)}>Ouvrir</button>
              </div>
            ))
          )}
        </>
      )}
      {showAddModal && (
        <InputModal
          title="Nouveau cycle"
          label="Nom du cycle"
          placeholder="ex: Cycle Badminton"
          onConfirm={async (name) => { setShowAddModal(false); await addTournament(name); }}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Supprimer le cycle"
          message={'Supprimer ' + deleteTarget.name + ' ? Action irreversible.'}
          confirmLabel="Supprimer"
          danger
          onConfirm={() => deleteTournament(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}