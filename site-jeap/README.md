# JEAP - Jeunes Etudiants Adventistes de Parakou

Plateforme de partage de documents academiques pour les etudiants de l'association JEAP a l'Universite de Parakou.

## Installation en local

1. Installer les dependances :
   ```
   npm install
   ```

2. Creer un projet sur [supabase.com](https://supabase.com), puis recuperer l'URL du projet et la cle "anon" (Project Settings > API).

3. Copier `.env.example` en `.env` et renseigner tes valeurs (pour reference), puis reporter les memes valeurs dans `src/js/config.js`.

4. Executer le script SQL `supabase/schema.sql` dans l'editeur SQL de ton projet Supabase (sera fourni a l'etape 4).

5. Executer ensuite `supabase/migration_bureau.sql` (ajoute la gestion dynamique du bureau exécutif, sans écraser les données déjà en place).

## Lancer le site en local

Deux terminaux :

**Terminal 1 - compiler le CSS Tailwind en continu :**
```
npm run dev:css
```

**Terminal 2 - servir le site :**
```
npm run serve
```
Puis ouvrir l'URL affichee (en general http://localhost:3000).

Alternative : utiliser l'extension "Live Server" de VS Code directement sur `public/index.html` (garder `npm run dev:css` actif dans un terminal a cote pour que le CSS se mette a jour).

## Build de production

```
npm run build:css
```
Cela genere une version minifiee de `dist/output.css`.

## Hebergement (a faire toi-meme, plus tard)

Ce projet est un site statique (HTML/CSS/JS) + Supabase. Il peut etre deploye tel quel sur Vercel ou Netlify :
- Netlify : glisser-deposer le dossier `public/` (+ `dist/`) dans l'interface, ou connecter le depot Git avec comme dossier de publication `public`.
- Vercel : connecter le depot Git, definir `public` comme dossier de sortie, aucune commande de build serveur necessaire (juste `npm run build:css` avant de deployer, ou en tant que build command).

Aucune action d'hebergement n'est effectuee automatiquement par l'IA : ces etapes sont a realiser par toi-meme.

## Etat d'avancement

- [x] Etape 1 : structure du projet + configuration de base
- [x] Etape 2 : maquette page d'accueil
- [x] Etape 3 : maquette arborescence de navigation
- [x] Etape 4 : schema Supabase + RLS
- [x] Etape 5 : authentification
- [x] Etape 6 : consultation / recherche / telechargement
- [x] Etape 7 : depot de documents
- [x] Etape 8 : panneau admin
- [x] Etape 9 : actualites

## A faire par toi-meme (non automatise par l'IA)

- Executer `supabase/schema.sql` dans l'editeur SQL de ton projet Supabase si ce n'est pas deja fait.
- Executer `supabase/migration_bureau.sql` (gestion dynamique du bureau exécutif + fusion avec la page Contact).
- Creer un bucket Storage nomme `jeap-docs` (public en lecture) dans Supabase > Storage.
- Promouvoir manuellement ton propre compte en administrateur : dans Supabase > Table editor > `profiles`,
  mettre `role = admin` et `status = approved` sur ta ligne (ou via une requete SQL `update`).
- Dans le panneau d'administration du site (page Admin > section "Bureau exécutif"), saisir la composition
  actuelle du bureau (les données de départ sont pré-remplies par la migration, il ne reste qu'à uploader
  les photos et vérifier les coordonnées).
- ✅ Nom de domaine mis à jour : le site utilise désormais `https://gilbertdagbemon-cell.github.io/JEAP/`
  dans `public/sitemap.xml`, `public/robots.txt` et les balises `og:image` des pages. Si un nom de domaine
  personnalisé est configuré un jour, refaire une recherche/remplacement sur ces mêmes fichiers.
- Deployer le site (voir section Hebergement ci-dessus).
