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

  async function addStudent(lastName​​​​​​​​​​​​​​​​
