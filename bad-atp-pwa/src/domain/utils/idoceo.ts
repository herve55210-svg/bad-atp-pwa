// ─── Utilitaires iDocéo ───────────────────────────────────────────────────────
//
// Format import iDocéo (CSV export depuis iDocéo) :
//   @name,@lastname,@group,@id,@e-mail,...
//   AHAMADI Eden-Youckfy,,Groupe 1,,,,,,,,,,    ← prénom+NOM dans @name, lastname vide
//   Joachim,lorent,,,,,,,,,,,                   ← prénom dans @name, NOM dans @lastname
//
// Format export vers iDocéo (re-import de colonnes de notes) :
//   @name,@lastname,@group,NomColonne,...
//   AHAMADI Eden-Youckfy,,Groupe 1,18.5,...

// Normalise une chaîne pour la comparaison (sans accents, minuscules)
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export interface IdoceoStudent {
  rawName: string;       // valeur brute colonne @name
  rawLastname: string;   // valeur brute colonne @lastname (souvent vide)
  group: string;
  // Champs déduits
  firstName: string;
  lastName: string;
  normalizedKey: string; // pour le matching
}

// Parse une ligne iDocéo et retourne un IdoceoStudent
function parseLine(cols: string[], header: string[]): IdoceoStudent | null {
  const nameIdx   = header.indexOf('@name');
  const lastIdx   = header.indexOf('@lastname');
  const groupIdx  = header.indexOf('@group');

  const rawName     = nameIdx >= 0     ? (cols[nameIdx]   ?? '').trim() : '';
  const rawLastname = lastIdx >= 0     ? (cols[lastIdx]   ?? '').trim() : '';
  const group       = groupIdx >= 0    ? (cols[groupIdx]  ?? '').trim() : '';

  if (!rawName) return null;

  let firstName = '';
  let lastName  = '';

  if (rawLastname) {
    // Cas séparé : @name = Prénom, @lastname = NOM
    firstName = rawName;
    lastName  = rawLastname;
  } else {
    // Cas fusionné : @name = "NOM Prénom" ou "DUPONT Emma"
    // iDocéo exporte souvent "NOM Prénom" avec NOM en majuscules
    const parts = rawName.split(' ');
    // On détecte si le premier token est tout en majuscules → c'est le NOM
    if (parts.length >= 2 && parts[0] === parts[0].toUpperCase() && /[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜŸ]/.test(parts[0])) {
      lastName  = parts[0];
      firstName = parts.slice(1).join(' ');
    } else {
      // Sinon on prend dernier token comme NOM (heuristique de secours)
      firstName = parts.slice(0, -1).join(' ');
      lastName  = parts[parts.length - 1];
    }
  }

  return {
    rawName, rawLastname, group,
    firstName: firstName.trim(),
    lastName:  lastName.trim(),
    normalizedKey: normalize(lastName + '_' + firstName)
  };
}

// Parse un CSV iDocéo complet
export function parseIdoceoCsv(text: string): IdoceoStudent[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  // Ligne d'en-tête (commence par @name)
  const headerLine = lines.find(l => l.startsWith('@name'));
  if (!headerLine) return [];

  // Séparateur : virgule (iDocéo standard)
  const sep = ',';
  const header = headerLine.split(sep).map(h => h.trim());

  const students: IdoceoStudent[] = [];
  for (const line of lines) {
    if (line.startsWith('@')) continue; // c'est l'en-tête
    const cols = line.split(sep);
    const s = parseLine(cols, header);
    if (s) students.push(s);
  }
  return students;
}

// ─── Export vers iDocéo ───────────────────────────────────────────────────────
//
// Génère un CSV que iDocéo accepte en import de colonnes de notes.
// Pour chaque élève (matchés par nom normalisé), on génère :
//   @name,@lastname,@group,Col1,Col2,...

export interface IdoceoExportColumn {
  header: string;
  getValue: (studentId: string) => string;
}

export interface IdoceoExportStudent {
  studentId: string;
  firstName: string;
  lastName: string;
}

export function buildIdoceoCsv(
  students: IdoceoExportStudent[],
  columns: IdoceoExportColumn[]
): string {
  const sep = ',';
  const colHeaders = columns.map(c => c.header).join(sep);
  const rows: string[] = [
    `@name${sep}@lastname${sep}@group${sep}${colHeaders}`
  ];

  for (const s of students) {
    const values = columns.map(c => c.getValue(s.studentId)).join(sep);
    // On reproduit le format iDocéo : @name = "NOM Prénom", @lastname vide
    rows.push(`${s.lastName.toUpperCase()} ${s.firstName}${sep}${sep}${sep}${values}`);
  }

  return rows.join('\n');
}
