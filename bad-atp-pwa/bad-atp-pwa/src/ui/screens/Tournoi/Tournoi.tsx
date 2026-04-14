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
