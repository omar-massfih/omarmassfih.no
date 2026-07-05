# omarmassfih.no

Personal website of Omar Massfih — projects, notes, and CV.

[omarmassfih.no](https://omarmassfih.no)

## Architecture

The site is a static [Eleventy](https://www.11ty.dev/) build deployed to GitHub Pages. Notes are authored in the companion backend repo ([omarmassfih.no-backend](https://github.com/omar-massfih/omarmassfih.no-backend)), seeded into Turso, and served by a FastAPI API at `backend.omarmassfih.no`.

At build time, `src/_data/backendNotes.js` loads all notes in one request (`GET /notes?include=content`) via `lib/notesLoader.js`.

`BACKEND_URL` can override `https://backend.omarmassfih.no`. The loader retries transient API failures before failing the build clearly instead of deploying stale notes.

## Development

```sh
npm install
npm run dev    # local dev server
npm run build  # builds to _site/
```

## Publishing a note

Add the note as an HTML file with front matter under `notes/` in the backend repo and push to `main`.

The backend repo seeds notes to Turso, then sends a `notes_updated` repository dispatch event to this repo. `.github/workflows/static.yml` receives that event, rebuilds from the backend API, and deploys the updated static site to GitHub Pages.

The backend repo needs an Actions secret named `FRONTEND_REDEPLOY_TOKEN` with permission to dispatch events to this repo.
