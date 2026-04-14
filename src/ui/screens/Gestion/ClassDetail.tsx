import React, { useEffect, useRef, useState } from 'react';
import { db, StudentRow } from '../../../domain/services/persistence/db';
import { normalizeKey } from '../../../domain/utils/normalize';
import { parseIdoceoCsv } from '../../../domain/utils/idoceo';
import { InputModal, ConfirmModal } from '../../components/Modal';
import { useToast } from '../../components/Toast';

const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

function Avatar({ student, size = 38 }: { student: StudentRow; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (student.photoBlob) {
      const u = URL.createObjectURL(student.photoBlob);
      setUrl(u);
      return () => URL.revokeObjectURL(u);
    }
  }, [student.photoBlob]);
  const initials = (student.firstName[0] ?? '') + (student.lastName[0] ?? '');
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: url ? 'transparent' : 'var(--accent-light)', color: 'var(--accent)' }}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials.toUpperCase()}
    </div>
  );
}

type EditField = 'lastName' | 'firstName';
interface EditState { student: StudentRow; field: EditField; }
interface AddStudentState { step: 'lastName' | 'firstName'; lastName: string; }

export default function ClassDetail({ classId, onChanged }: { classId: string; onChanged: () => void }) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [addState, setAddState] = useState<AddStudentState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const idoceoRef = useRef<HTMLInputElement>(null);
  const { show } = useToast();

  async function refresh() {
    const rows = await db.students.where('classId').equals(classId).sortBy('lastName');
    setStudents(rows);
  }

  useEffect(() => { refresh(); }, [classId]);

  async function addStudent(lastName: string, firstName: string) {
    await db.students.add({
      id: uuid(), classId, lastName, firstName,
      normalizedKey: normalizeKey(lastName + '_' + firstName),
      createdAt: nowIso(), updatedAt: nowIso()
    });
    await refresh();
    onChanged();
    show(firstName + ' ' + lastName + ' ajoute');
  }

  async function deleteStudent(s: StudentRow) {
    await db.students.delete(s.id);
    await refresh();
    onChanged();
    show(s.firstName + ' supprime');
  }

  async function renameStudent(student: StudentRow, field: EditField, newValue: string) {
    const newLast = field === 'lastName' ? newValue : student.lastName;
    const newFirst = field === 'firstName' ? newValue : student.firstName;
    await db.students.update(student.id, {
      [field]: newValue,
      normalizedKey: normalizeKey(newLast + '_' + newFirst),
      updatedAt: nowIso(),
    });
    await refresh();
    onChanged();
    show('Eleve modifie');
  }

  async function importSimpleCsv(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
    let added = 0;
    for (const line of lines) {
      const parts = line.split(';');
      if (parts.length < 2) continue;
      const lastName = parts[0].trim();
      const firstName = parts[1].trim();
      if (!lastName) continue;
      await db.students.add({
        id: uuid(), classId, lastName, firstName,
        normalizedKey: normalizeKey(lastName + '_' + firstName),
        createdAt: nowIso(), updatedAt: nowIso()
      });
      added++;
    }
    await refresh();
    onChanged();
    show(added + ' importe(s)');
  }

  async function importIdoceoCsv(file: File) {
    const text = await file.text();
    const parsed = parseIdoceoCsv(text);
    if (!parsed.length) { show('Aucun eleve detecte'); return; }
    const existing = await db.students.where('classId').equals(classId).toArray();
    const existingKeys = new Set(existing.map((s: StudentRow) => normalizeKey(s.lastName + '_' + s.firstName)));
    let added = 0;
    let skipped = 0;
    for (const s of parsed) {
      const key = normalizeKey(s.lastName + '_' + s.firstName);
      if (existingKeys.has(key)) { skipped++; continue; }
      await db.students.add({
        id: uuid(), classId, lastName: s.lastName, firstName: s.firstName,
        normalizedKey: key, createdAt: nowIso(), updatedAt: nowIso()
      });
      added++;
    }
    await refresh();
    onChanged();
    show(added + ' ajoute(s), ' + skipped + ' ignore(s)');
  }

  async function exportCsv() {
    const rows = await db.students.where('classId').equals(classId).toArray();
    const content = rows.map((r: StudentRow) => r.lastName + ';' + r.firstName).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'classe.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function addPhoto(student: StudentRow) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    (input as any).capture = 'environment';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      await db.students.update(student.id, { photoBlob: f, photoUpdatedAt: nowIso(), updatedAt: nowIso() });
      await refresh();
    };
    input.click();
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button className="primary" onClick={() => setAddState({ step: 'lastName', lastName: '' })}>+ Eleve</button>
        <button onClick={() => idoceoRef.current?.click()} style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 }}>
          Import iDoceo
        </button>
        <button onClick={() => fileRef.current?.click()}>CSV</button>
        <button className="ghost" onClick={exportCsv}>Export</button>
      </div>

      <input ref={idoceoRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) importIdoceoCsv(f); e.currentTarget.value = ''; }} />
      <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) importSimpleCsv(f); e.currentTarget.value = ''; }} />

      {students.length === 0 ? (
        <div className="empty"><div className="empty-icon">🎓</div><p>Aucun eleve.</p></div>
      ) : (
        <>
          <div className="small" style={{ marginBottom: 8 }}>{students.length} eleve{students.length > 1 ? 's' : ''}</div>
          {students.map(s => (
            <div key={s.id} className="rollcall-item">
              <div className="row" style={{ gap: 12, flex: 1 }}>
                <div onClick={() => addPhoto(s)} style={{ cursor: 'pointer' }}>
                  <Avatar student={s} />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.lastName}</div>
                  <div className="small">{s.firstName}</div>
                </div>
              </div>
              <button className="ghost" style={{ fontSize: 16, padding: '6px 8px' }} onClick={() => setEditState({ student: s, field: 'lastName' })}>
                ✏️
              </button>
              <button className="ghost" style={{ fontSize: 18, padding: '6px 8px', color: '#C0392B' }} onClick={() => setDeleteTarget(s)}>
                🗑
              </button>
            </div>
          ))}
        </>
      )}

      {addState?.step === 'lastName' && (
        <InputModal title="Nouvel eleve" label="Nom" placeholder="DUPONT"
          onConfirm={val => setAddState({ step: 'firstName', lastName: val })}
          onClose={() => setAddState(null)} />
      )}
      {addState?.step === 'firstName' && (
        <InputModal title={'Prenom de ' + addState.lastName} label="Prenom" placeholder="Emma"
          onConfirm={val => { addStudent(addState.lastName, val); setAddState(null); }}
          onClose={() => setAddState(null)} />
      )}
      {editState !== null && editState.field === 'lastName' && (
        <InputModal title="Modifier nom" label="Nom" placeholder="DUPONT"
          defaultValue={editState.student.lastName}
          onConfirm={val => { renameStudent(editState.student, 'lastName', val); setEditState(null); }}
          onClose={() => setEditState(null)} />
      )}
      {editState !== null && editState.field === 'firstName' && (
        <InputModal title="Modifier prenom" label="Prenom" placeholder="Emma"
          defaultValue={editState.student.firstName}
          onConfirm={val => { renameStudent(editState.student, 'firstName', val); setEditState(null); }}
          onClose={() => setEditState(null)} />
      )}
      {deleteTarget !== null && (
        <ConfirmModal
          title="Supprimer"
          message={'Supprimer ' + deleteTarget.firstName + ' ' + deleteTarget.lastName + ' ?'}
          confirmLabel="Supprimer"
          danger
          onConfirm={() => deleteStudent(deleteTarget)}
          onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}