import React, { useState } from 'react';

type Section = 'install' | 'vercel' | 'csv' | 'bareme' | 'data';

export default function Infos() {
  const [open, setOpen] = useState<Section | null>('install');
  const toggle = (s: Section) => setOpen(prev => prev === s ? null : s);

  const Section = ({ id, title, children }: { id: Section; title: string; children: React.ReactNode }) => (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 10 }}>
      <button
        onClick={() => toggle(id)}
        style={{
          width: '100%', textAlign: 'left', border: 'none', borderRadius: 'var(--radius)',
          padding: '14px 16px', background: 'transparent', fontWeight: 600, fontSize: 15,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}
      >
        {title}
        <span style={{ fontSize: 18, color: 'var(--text2)', transition: 'transform 0.2s', transform: open === id ? 'rotate(90deg)' : 'none' }}>›</span>
      </button>
      {open === id && (
        <div style={{ padding: '0 16px 16px' }}>
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Infos</h1>
      </div>
      <p className="page-subtitle">Bad Défis ATP — v0.2.0</p>

      <Section id="install" title="📲 Installer sur iPhone / iPad">
        <ol style={{ margin: '0 0 0 -4px', paddingLeft: 22, lineHeight: 2, fontSize: 15 }}>
          <li>Ouvre l'app dans <strong>Safari</strong> (pas Chrome)</li>
          <li>Appuie sur <strong>Partager</strong> (icône carré ↑)</li>
          <li>Choisis <strong>"Sur l'écran d'accueil"</strong></li>
          <li>Confirme → l'icône Bad ATP apparaît</li>
        </ol>
        <div className="small" style={{ marginTop: 8, padding: '8px 12px', background: 'var(--accent-light)', borderRadius: 8 }}>
          ✅ Une fois installée, l'app fonctionne <strong>entièrement hors ligne</strong>.
        </div>
      </Section>

      <Section id="vercel" title="🌐 Déployer sur Vercel (accès partout)">
        <div className="small" style={{ lineHeight: 1.8 }}>
          <strong>1. Mets le projet sur GitHub</strong><br />
          Crée un dépôt sur <em>github.com</em>, puis dans le terminal :<br />
          <div style={{ fontFamily: 'monospace', background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', margin: '6px 0', fontSize: 13 }}>
            git init<br />
            git add .<br />
            git commit -m "init"<br />
            git remote add origin https://github.com/TOI/bad-atp.git<br />
            git push -u origin main
          </div>

          <strong>2. Connecte Vercel</strong><br />
          Va sur <em>vercel.com</em> → "Add New Project" → importe ton dépôt GitHub.
          Vercel détecte Vite automatiquement :<br />
          <div style={{ fontFamily: 'monospace', background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', margin: '6px 0', fontSize: 13 }}>
            Build command : npm run build<br />
            Output dir : dist
          </div>

          <strong>3. Déploie</strong><br />
          Clique "Deploy" → tu obtiens une URL du type <em>bad-atp.vercel.app</em>.<br /><br />

          <strong>4. Installe sur iPhone / iPad</strong><br />
          Ouvre l'URL dans Safari → Partager → Sur l'écran d'accueil.
        </div>
        <div className="small" style={{ marginTop: 8, padding: '8px 12px', background: 'var(--green-light)', borderRadius: 8 }}>
          💡 Vercel redéploie automatiquement à chaque <em>git push</em>.
          Les données restent locales sur chaque appareil.
        </div>
      </Section>

      <Section id="csv" title="📁 Import CSV élèves">
        <div className="small">Une ligne par élève, séparateur <strong>point-virgule</strong> :</div>
        <div style={{ fontFamily: 'monospace', background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', marginTop: 8, fontSize: 14, lineHeight: 1.8 }}>
          DUPONT;Emma<br />
          MARTIN;Noa<br />
          BERNARD;Lucas
        </div>
        <div className="small" style={{ marginTop: 8 }}>
          Pas de ligne d'en-tête. Encodage UTF-8 recommandé.
        </div>
      </Section>

      <Section id="bareme" title="🏸 Barème des points">
        <div className="small" style={{ lineHeight: 1.9 }}>
          <strong>Vainqueur :</strong> 3.0 pts de base.<br />
          +0.5 pts par rang d'écart si l'adversaire est <em>mieux classé</em>.<br />
          −0.5 pts par rang si l'adversaire est <em>moins bien classé</em>.<br />
          Écart plafonné par <em>diffCap</em> (réglable).<br /><br />
          <strong>Perdant :</strong> points de consolation (réglable).<br />
          <strong>Arbitre :</strong> points d'arbitrage (réglable). Les dispensés peuvent arbitrer.<br />
          <strong>Auto-arbitré :</strong> bonus vainqueur (réglable).
        </div>
      </Section>

      <Section id="data" title="💾 Données & vie privée">
        <div className="small" style={{ lineHeight: 1.8 }}>
          Toutes les données (classes, élèves, scores) sont stockées <strong>localement sur l'appareil</strong> via IndexedDB.<br />
          Rien n'est envoyé sur un serveur.<br /><br />
          Pour effacer toutes les données : Réglages Safari → Avancé → Données de sites → Supprimer.
        </div>
      </Section>
    </div>
  );
}
