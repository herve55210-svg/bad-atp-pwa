import React, { useEffect, useRef, useState } from 'react';
import { db, SettingsRow } from '../../../domain/services/persistence/db';
import { exportSnapshot, importSnapshot, triggerJsonDownload, ImportMode } from '../../../domain/services/persistence/sync';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';

export default function Settings() {
  const [s, setS] = useState<SettingsRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const fileRef = useRef<HTMLInputElement>(null);
  const { show } = useToast();

  useEffect(() => {
    db.settings.toCollection().first().then(row => { if (row) setS(row); });
  }, []);

  async function save() {
    if (!s) return;
    await db.settings.update(s.id, {
      maxChallengeDisplay: s.maxChallengeDisplay,
      arbPoints: s.arbPoints,
      loserPoints: s.loserPoints,
      diffCap: s.diffCap,
      autoRefBonus: s.autoRefBonus,
      updatedAt: new Date().toISOString()
    });
    show('Paramètres sauvegardés ✓');
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  async function doExport() {
    const json = await exportSnapshot('Mon appareil');
    const date = new Date().toISOString().slice(0, 10);
    triggerJsonDownload(json, `bad-atp-${date}.json`);
    show('Export téléchargé ✓ — envoie-le via AirDrop ou iCloud Drive');
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  async function onFileSelected(file: File) {
    const text = await file.text();
    setPendingFile(text);
    setShowImportModal(true);
  }

  async function doImport() {
    if (!pendingFile) return;
    setImporting(true);
    setShowImportModal(false);
    const result = await importSnapshot(pendingFile, importMode);
    setImporting(false);
    setPendingFile(null);
    setImportResult(result);
    if (result.ok) {
      show('Import réussi ✓ — rechargement…');
      setTimeout(() => window.location.reload(), 1200);
    } else {
      show('Erreur import : ' + result.message);
    }
  }

  if (!s) return <div className="empty"><div className="empty-icon">⏳</div><p>Chargement…</p></div>;

  const Field = ({ label, desc, field, step = 0.5 }: { label: string; desc?: string; field: keyof SettingsRow; step?: number }) => (
    <div className="card">
      <div className="row-between">
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{label}</div>
          {desc && <div className="small">{desc}</div>}
        </div>
        <input
          type="number" step={step}
          value={s[field] as number}
          onChange={e => setS({ ...s, [field]: parseFloat(e.target.value) })}
          style={{ width: 80, textAlign: 'center' }}
        />
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Réglages</h1>
        <button className="primary" onClick={save}>Sauver</button>
      </div>
      <p className="page-subtitle">Barème des points ATP</p>

      <Field label="Points arbitrage" desc="Points gagnés en arbitrant un match" field="arbPoints" />
      <Field label="Points perdant" desc="Points consolation pour le perdant" field="loserPoints" />
      <Field label="Borne écart (diffCap)" desc="Écart de rang max pour le bonus vainqueur" field="diffCap" step={1} />
      <Field label="Bonus auto-arbitré" desc="Bonus pour le vainqueur d'un match auto-arbitré" field="autoRefBonus" />
      <Field label="Max adversaires affichés" desc="Nombre de joueurs au-dessus à défier" field="maxChallengeDisplay" step={1} />

      <div className="card" style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)' }}>
        <div className="small">
          <strong>Barème vainqueur :</strong> +3.0 pts (même rang), +3.5 si 1 rang en dessous, +1.0 si 5 rangs en dessous.
          L'écart de rang est plafonné à <strong>diffCap</strong>.
        </div>
      </div>

      {/* ── Synchronisation ────────────────────────────────────────────── */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 4 }}>
          Synchronisation
        </div>
        <div className="small" style={{ marginBottom: 14 }}>
          Transfère tes données entre iPhone et iPad via AirDrop ou iCloud Drive.
        </div>

        {/* Export */}
        <div className="card">
          <div className="card-title">📤 Exporter vers un autre appareil</div>
          <div className="small" style={{ marginBottom: 12 }}>
            Génère un fichier <strong>bad-atp-YYYY-MM-DD.json</strong> avec toutes tes données
            (classes, élèves, tournois, scores, historique). Envoie-le par AirDrop ou enregistre-le dans iCloud Drive.
          </div>
          <button className="primary full" onClick={doExport}>
            📤 Exporter toutes les données
          </button>
        </div>

        {/* Import */}
        <div className="card">
          <div className="card-title">📥 Importer depuis un autre appareil</div>
          <div className="small" style={{ marginBottom: 12 }}>
            Sélectionne un fichier <strong>.json</strong> exporté depuis l'autre appareil.
            Tu peux fusionner (garde les données locales plus récentes) ou tout remplacer.
          </div>
          <button className="full" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? '⏳ Import en cours…' : '📥 Sélectionner un fichier .json'}
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelected(f); e.currentTarget.value = ''; }} />
        </div>

        {/* Guide rapide */}
        <div className="card" style={{ background: 'var(--surface2)' }}>
          <div className="card-title" style={{ marginBottom: 8 }}>📱 Comment synchroniser</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.9 }}>
            <strong>Via AirDrop (instantané)</strong><br />
            1. Sur l'appareil A → Exporter<br />
            2. Le fichier s'ouvre dans Fichiers → appuie sur Partager ↑ → AirDrop → choisis l'appareil B<br />
            3. Sur l'appareil B → accepte → ouvre Bad ATP → Réglages → Importer<br /><br />

            <strong>Via iCloud Drive (automatique)</strong><br />
            1. Sur l'appareil A → Exporter → enregistre dans iCloud Drive<br />
            2. Sur l'appareil B → Importer → sélectionne le fichier dans iCloud Drive<br />
          </div>
        </div>
      </div>

      {/* Modal confirmation import */}
      {showImportModal && (
        <Modal
          title="Importer les données"
          onClose={() => { setShowImportModal(false); setPendingFile(null); }}
          actions={
            <>
              <button className="ghost" onClick={() => { setShowImportModal(false); setPendingFile(null); }}>Annuler</button>
              <button className="primary" onClick={doImport}>Importer</button>
            </>
          }
        >
          <div style={{ marginBottom: 16 }}>
            <div className="small" style={{ marginBottom: 12 }}>Choisis comment importer :</div>
            <div className="mode-toggle">
              <button
                className={`mode-btn${importMode === 'merge' ? ' active' : ''}`}
                onClick={() => setImportMode('merge')}
              >
                🔀 Fusionner
              </button>
              <button
                className={`mode-btn${importMode === 'replace' ? ' active' : ''}`}
                onClick={() => setImportMode('replace')}
              >
                ♻️ Remplacer
              </button>
            </div>
            <div className="small" style={{ marginTop: 10, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10, lineHeight: 1.7 }}>
              {importMode === 'merge'
                ? '🔀 Fusion : les enregistrements les plus récents gagnent. Rien n\'est supprimé. Recommandé si tu as travaillé sur les deux appareils.'
                : '♻️ Remplacer : toutes tes données locales sont remplacées par le fichier importé. Utilise ça pour mettre l\'iPad exactement à jour depuis l\'iPhone.'}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
