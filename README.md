# omarmassfih.no

Personal website of Omar Massfih — projects, notes, and CV.

[omarmassfih.no](https://omarmassfih.no)

## Architecture

The site is a static [Eleventy](https://www.11ty.dev/) build deployed to GitHub Pages. Notes are authored in the companion backend repo ([omarmassfih.no-backend](https://github.com/omar-massfih/omarmassfih.no-backend)), seeded into Turso, and served by a FastAPI API at `backend.omarmassfih.no`.

At build time, `src/_data/backendNotes.js` loads all notes in one request (`GET /notes?include=content`) via `lib/notesLoader.js`, with a three-level fallback so a backend outage never breaks a deploy:

1. Backend API (`BACKEND_URL` env var overrides `https://backend.omarmassfih.no`)
2. Sibling repo checkout at `../omarmassfih.no-backend/notes` (offline authoring)
3. Committed `notes-snapshot.json`

Each fallback logs a warning in the build output, so a stale deploy is visible in the Actions log. Every build that gets fresh notes (levels 1 and 2) rewrites `notes-snapshot.json` automatically — commit it when it changes.

## Development

```sh
npm install
npm run dev    # local dev server
npm run build  # builds to _site/
```

## Publishing a note

1. Add the note as an HTML file with front matter under `notes/` in the backend repo and push to `main` — the seed workflow writes it to Turso.
2. In this repo, run `npm run build` and commit the refreshed `notes-snapshot.json`.
3. Push to `master` — `.github/workflows/static.yml` builds and deploys to GitHub Pages.
