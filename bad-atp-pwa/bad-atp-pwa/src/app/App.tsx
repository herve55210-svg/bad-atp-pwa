import React, { useEffect, useState } from 'react';
import { ensureSeedData } from '../domain/services/persistence/seed';
import Gestion from '../ui/screens/Gestion/Gestion';
import Tournoi from '../ui/screens/Tournoi/Tournoi';
import Settings from '../ui/screens/Settings/Settings';
import Infos from '../ui/screens/Infos/Infos';
import { ToastProvider } from '../ui/components/Toast';

type TabKey = 'tournoi' | 'gestion' | 'settings' | 'infos';

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'tournoi', label: 'Tournoi', icon: '🏸' },
  { key: 'gestion', label: 'Classes', icon: '👥' },
  { key: 'settings', label: 'Réglages', icon: '⚙️' },
  { key: 'infos', label: 'Infos', icon: 'ℹ️' },
];

export default function App() {
  const [tab, setTab] = useState<TabKey>('tournoi');

  useEffect(() => { ensureSeedData(); }, []);

  return (
    <ToastProvider>
      <div className="app">
        <div className="screen">
          {tab === 'tournoi' && <Tournoi />}
          {tab === 'gestion' && <Gestion />}
          {tab === 'settings' && <Settings />}
          {tab === 'infos' && <Infos />}
        </div>
        <nav className="bottom-nav">
          {TABS.map(t => (
            <button key={t.key} className={'nav-item' + (tab === t.key ? ' active' : '')} onClick={() => setTab(t.key)}>
              <span className="nav-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </ToastProvider>
  );
}
