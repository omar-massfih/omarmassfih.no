const DEFAULT_BACKEND_URL = "https://backend.omarmassfih.no";
const DEFAULT_BACKEND_NOTES_ATTEMPTS = 5;
const DEFAULT_BACKEND_NOTES_RETRY_DELAY_MS = 10000;
const DEFAULT_BACKEND_NOTES_TIMEOUT_MS = 15000;

// Mirrors normalize_tags in the backend's app/notes.py - keep the rules in sync.
function normalizeTags(value) {
  const parts = Array.isArray(value) ? value : (value || "").split(",");
  const tags = [];

  for (const part of parts) {
    const tag = String(part).trim().toLowerCase().split(/\s+/).filter(Boolean).join("-");
    if (tag && !tags.includes(tag)) tags.push(tag);
  }

  return tags;
}

function normalizeNote(note) {
  let date = note.date || new Date().toISOString().slice(0, 10);

  // The backend passes front matter dates through as free-form strings; a
  // malformed one would otherwise crash the whole build in toISOString below.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) {
    console.warn(`[backendNotes] Note "${note.slug}" has invalid date "${date}"; using today`);
    date = new Date().toISOString().slice(0, 10);
  }

  return {
    ...note,
    date,
    date_iso: new Date(`${date}T00:00:00.000Z`).toISOString(),
    tags: normalizeTags(note.tags),
  };
}

function positiveIntegerEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBackendNotes() {
  const backendUrl = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;
  // Bust the API edge cache (Cache-Control s-maxage=300) so a build always
  // reads freshly seeded notes. The backend dispatches this rebuild right after
  // writing to the database, which can be sooner than the cache would refresh
  // on its own, so a plain request risks building from a stale note list. The
  // unique query param makes the CDN miss its cache and read from origin; the
  // /notes route ignores unknown params.
  const url = `${backendUrl}/notes?include=content&fresh=${Date.now()}`;
  const response = await fetch(url, {
    headers: { "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(
      positiveIntegerEnv("BACKEND_NOTES_TIMEOUT_MS", DEFAULT_BACKEND_NOTES_TIMEOUT_MS)
    ),
  });

  if (!response.ok) {
    throw new Error(`Backend notes request failed with ${response.status}`);
  }

  const notes = await response.json();

  return notes.map(normalizeNote);
}

async function loadBackendNotes() {
  const attempts = positiveIntegerEnv("BACKEND_NOTES_ATTEMPTS", DEFAULT_BACKEND_NOTES_ATTEMPTS);
  const retryDelayMs = positiveIntegerEnv(
    "BACKEND_NOTES_RETRY_DELAY_MS",
    DEFAULT_BACKEND_NOTES_RETRY_DELAY_MS
  );

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetchBackendNotes();
    } catch (error) {
      if (attempt === attempts) {
        throw new Error(
          `Backend notes fetch failed after ${attempts} attempts: ${error.message}`
        );
      }

      console.warn(
        `[backendNotes] Backend fetch attempt ${attempt}/${attempts} failed (${error.message}); ` +
          `retrying in ${retryDelayMs}ms`
      );
      await sleep(retryDelayMs);
    }
  }
}

export default async function () {
  const notes = await loadBackendNotes();

  notes.sort((left, right) => right.date.localeCompare(left.date));

  return notes;
}
