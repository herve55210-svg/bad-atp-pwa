# Bad Défis ATP — PWA offline (MVP)

## Ce que fait ce MVP
- Multi-classes (création + import CSV `NOM;Prénom`)
- Tournoi (= cycle) par classe
- Nouvelle séance datée **→ ouvre automatiquement “Appel rapide”**
- Statuts séance: PRESENT / ABSENT / DISPENSE (dispensé **peut arbitrer**)
- Classement live + points + stats séance (G/P/A)
- Match **auto-arbitré** + match **arbitré** (barème + borne écart >5)
- Fonctionne offline via PWA (Service Worker)

## Installer / lancer en local
1. Installer Node.js (18+).
2. Dans le dossier:
   ```bash
   npm install
   npm run dev
   ```
3. Ouvrir l'URL locale dans Safari (iPad/iPhone) si tu testes sur le réseau.

## Déployer pour avoir un lien (iPad/iPhone)
Option simple: **Vercel**
1. Mets ce projet sur GitHub (ou zip → import Vercel).
2. Vercel détecte Vite, build = `npm run build`, output = `dist`.
3. Tu obtiens une URL. Ouvre dans Safari → Partager → “Sur l’écran d’accueil”.

## Import CSV
Une ligne par élève:
```
DUPONT;Emma
MARTIN;Noa
```

## Prochaines itérations (faciles)
- Import iDoceo photos ZIP + matching automatique
- Exports CSV séance + cycle
- Poules/terrains parallèles
- Undo (annuler dernière action)
- Classement initial par drag&drop (au lieu d'alphabétique)
