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

The frontend also rebuilds daily as a fallback, so backend-driven pages and the sitemap recover automatically if a dispatch is missed.

The backend repo needs an Actions secret named `FRONTEND_REDEPLOY_TOKEN` with permission to dispatch events to this repo.

## Public URLs

Pages use directory URLs: `/`, `/projects/`, `/notes/`, `/cv/` and `/about/`. Notes and categories also use trailing slashes. Old named `.html` URLs are no longer generated and have no redirects. GitHub Pages still serves `index.html` internally and uses `404.html` for missing pages.

## Styling

The design tokens in `src/style.css` are the style guide. Use the existing colors, type scale and spacing tokens when adding or changing components.

- All pages use the `--container` reading width and responsive `--gutter`. Text, section headings, rows and filter bars share `--content-inset` (12px), while their horizontal rules can span the container.
- Use the 4px spacing scale: 8px for small gaps, 12px for component insets, 16–24px inside components, and 32–48px between sections. Primary controls use `--control-size` (44px); passive tags stay compact.
- Use `.section-head` for section headings and `.list-row` for note links. Keep article typography scoped to `.note-content` so it cannot change navigation, table-of-contents or graph headings.
- Check desktop and mobile layouts, both themes, keyboard focus, and CV printing. Wide code blocks and tables should scroll within the content rather than widen the page.
