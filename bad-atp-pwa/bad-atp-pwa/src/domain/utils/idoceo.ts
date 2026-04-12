// ─── Utilitaires iDocéo ───────────────────────────────────────────────────────

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export interface IdoceoStudent {
  firstName: string;
  lastName: string;
  normalizedKey: string;
}

export function parseIdoceoCsv(text: string): IdoceoStudent[] {
  // Nettoie le BOM et normalise les fins de ligne
  let clean = text;
  // Enlève BOM UTF-8 et UTF-16
  clean = clean.replace(/^\uFEFF/, '').replace(/^\u00EF\u00BB\u00BF/, '');
  clean = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (!lines.length) return [];

  // Cherche la ligne d'en-tête (contient @name, insensible casse)
  const headerIdx = lines.findIndex(l => /@name/i.test(l));

  if (headerIdx === -1) {
    // Pas d'en-tête iDocéo standard — essaie NOM;Prénom
    return parseFallback(lines);
  }

  const headerLine = lines[headerIdx];

  // Détecte séparateur : point-virgule prioritaire sur virgule
  const sep = headerLine.indexOf(';') >= 0 ? ';' : ',';

  // Parse l'en-tête en enlevant les colonnes vides de fin
  const headers = headerLine.split(sep).map(h => h.trim().toLowerCase().replace(/^@/, ''));

  const nameIdx  = headers.findIndex(h => h === 'name');
  const lastIdx  = headers.findIndex(h => h === 'lastname');

  if (nameIdx === -1) return parseFallback(lines.slice(headerIdx + 1));

  const students: IdoceoStudent[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cols = line.split(sep);
    const rawName = nameIdx < cols.length ? cols[nameIdx].trim() : '';
    const rawLast = lastIdx >= 0 && lastIdx < cols.length ? cols[lastIdx].trim() : '';

    if (!rawName) continue;

    let firstName = '';
    let lastName  = '';

    if (rawLast) {
      // Cas: @name=Prénom, @lastname=NOM (ex: "Joachim;lorent")
      firstName = rawName;
      lastName  = rawLast;
    } else {
      // Cas: @name="NOM Prénom" (ex: "AHAMADI Eden-Youckfy")
      const parts = rawName.split(' ').filter(p => p.length > 0);
      if (parts.length === 1) {
        lastName  = parts[0];
        firstName = '';
      } else {
        // Trouve la frontière NOM/Prénom
        // NOM = mots tout en majuscules, Prénom = mots avec minuscules
        let splitIdx = parts.length - 1; // par défaut dernier mot = prénom
        for (let j = 0; j < parts.length; j++) {
          const word = parts[j];
          // Si ce mot contient des minuscules, c'est le début du prénom
          if (word !== word.toUpperCase()) {
            splitIdx = j;
            break;
          }
        }
        if (splitIdx === 0) splitIdx = 1; // au moins un mot pour le NOM
        lastName  = parts.slice(0, splitIdx).join(' ');
        firstName = parts.slice(splitIdx).join(' ');
      }
    }

    // Normalise la casse : NOM en majuscules, Prénom en Titre
    lastName  = lastName.toUpperCase();
    firstName = toTitleCase(firstName);

    if (!lastName && !firstName) continue;

    students.push({
      firstName,
      lastName,
      normalizedKey: normalize(`${lastName}_${firstName}`)
    });
  }

  return students;
}

function toTitleCase(s: string): string {
  return s.replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function parseFallback(lines: string[]): IdoceoStudent[] {
  const students: IdoceoStudent[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const sep = line.includes(';') ? ';' : ',';
    const parts = line.split(sep);
    if (parts.length >= 2) {
      const lastName  = parts[0].trim().toUpperCase();
      const firstName = toTitleCase(parts[1].trim());
      if (lastName) students.push({ lastName, firstName, normalizedKey: normalize(`${lastName}_${firstName}`) });
    }
  }
  return students;
}

// ─── Export vers iDocéo ───────────────────────────────────────────────────────

export interface IdoceoExportColumn {
  header: string;
  getValue: (studentId: string) => string;
}

export interface IdoceoExportStudent {
  studentId: string;
  firstName: string;
  lastName: string;
}

export function buildIdoceoCsv(students: IdoceoExportStudent[], columns: IdoceoExportColumn[]): string {
  const sep = ',';
  const colHeaders = columns.map(c => c.header).join(sep);
  const rows: string[] = [`@name${sep}@lastname${sep}@group${sep}${colHeaders}`];
  for (const s of students) {
    const values = columns.map(c => c.getValue(s.studentId)).join(sep);
    rows.push(`${s.lastName} ${s.firstName}${sep}${sep}${sep}${values}`);
  }
  return rows.join('\n');
}
