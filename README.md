# omarmassfih.no

Personal website of Omar Massfih — projects, notes, and CV.

[omarmassfih.no](https://omarmassfih.no)

## Architecture

The site is a static [Eleventy](https://www.11ty.dev/) build deployed to GitHub Pages. Notes are authored in the companion backend repo ([omarmassfih.no-backend](https://github.com/omar-massfih/omarmassfih.no-backend)), seeded into Turso, and served by a FastAPI API at `backend.omarmassfih.no`.

At build time, `src/_data/backendNotes.js` loads all notes in one request (`GET /notes?include=content`) via `lib/notesLoader.js`, with a local fallback for offline development:

1. Backend API (`BACKEND_URL` env var overrides `https://backend.omarmassfih.no`)
2. Sibling repo checkout at `../omarmassfih.no-backend/notes` (offline authoring)

If the backend API and local sibling repo are both unavailable, the build fails clearly instead of deploying stale notes.

## Development

```sh
npm install
npm run dev    # local dev server
npm run build  # builds to _site/
```

## Publishing a note

1. Add the note as an HTML file with front matter under `notes/` in the backend repo and push to `main` — the seed workflow writes it to Turso.
2. Push this repo to `master` — `.github/workflows/static.yml` builds from the backend API and deploys to GitHub Pages.
