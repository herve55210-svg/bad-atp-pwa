import React, { useEffect, useState } from 'react';
import { db, ClassRow } from '../../../domain/services/persistence/db';
import ClassDetail from './ClassDetail';
import { InputModal, ConfirmModal } from '../../components/Modal';
import { useToast } from '../../components/Toast';

const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

export default function Gestion() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);
  const [tick, setTick] = useState(0); // force re-render
  const { show } = useToast();

  async function refresh() {
    const rows = await db.classes.orderBy('name').toArray();
    setClasses(rows);
    setTick(t => t + 1); // force update
  }

  useEffect(() => { refresh(); }, []);

  async function addClass(name: string) {
    try {
      await db.classes.add({ id: uuid(), name, createdAt: nowIso(), updatedAt: nowIso() });
      // Refresh multiple times to ensure UI updates
      const rows = await db.classes.orderBy('name').toArray();
      setClasses([...rows]); // new array reference forces re-render
      show(`Classe "${name}" créée ✓`);
    } catch (e) {
      show('Erreur lors de la création : ' + (e as Error).message);
    }
  }

  async function deleteClass(c: ClassRow) {
    await db.classes.delete(c.id);
    await db.students.where('classId').equals(c.id).delete();
    const rows = await db.classes.orderBy('name').toArray();
    setClasses([...rows]);
    show(`Classe "${c.name}" supprimée`);
  }

  if (selectedClassId) {
    const c = classes.find(x => x.id === selectedClassId);
    return (
      <div>
        <div className="page-header">
          <button className="ghost" onClick={() => setSelectedClassId(null)} style={{padding:'8px 0', fontSize:20}}>←</button>
          <h1 className="page-title" style={{flex:1}}>{c?.name ?? 'Classe'}</h1>
        </div>
        <ClassDetail classId={selectedClassId} onChanged={refresh} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Classes</h1>
        <button className="primary" onClick={() => setShowAddModal(true)}>+ Classe</button>
      </div>
      <p className="page-subtitle">Gérez vos classes et vos élèves</p>

      {classes.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🏫</div>
          <p>Aucune classe.<br />Commencez par en créer une.</p>
        </div>
      ) : (
        classes.map(c => (
          <div key={c.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setSelectedClassId(c.id)}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17 }}>{c.name}</div>
              <div className="small">Appuyer pour gérer les élèves</div>
            </div>
            <button className="ghost" style={{ fontSize: 18, padding: '8px 10px' }} onClick={() => setDeleteTarget(c)}>🗑</button>
            <button className="primary" onClick={() => setSelectedClassId(c.id)}>Ouvrir →</button>
          </div>
        ))
      )}

      {showAddModal && (
        <InputModal
          title="Nouvelle classe"
          label="Nom de la classe"
          placeholder="ex: 4E1, 3B…"
          onConfirm={async (name) => {
            setShowAddModal(false); // ferme d'abord
            await addClass(name);   // puis crée
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Supprimer la classe"
          message={`Supprimer "${deleteTarget.name}" et tous ses élèves ? Cette action est irréversible.`}
          confirmLabel="Supprimer"
          danger
          onConfirm={() => deleteClass(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
