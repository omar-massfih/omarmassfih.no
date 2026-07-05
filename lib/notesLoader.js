import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BACKEND_URL = "https://backend.omarmassfih.no";

function parseFrontMatter(raw, sourcePath) {
  if (!raw.startsWith("---\n")) {
    throw new Error(`${sourcePath} is missing front matter`);
  }

  const end = raw.indexOf("\n---", 4);
  if (end === -1) {
    throw new Error(`${sourcePath} has unterminated front matter`);
  }

  const frontMatter = raw.slice(4, end);
  const content = raw.slice(end + 4);
  const data = {};

  for (const line of frontMatter.trim().split("\n")) {
    if (!line.trim()) continue;

    const separator = line.indexOf(":");
    if (separator === -1) {
      throw new Error(`${sourcePath} has invalid front matter line: ${line}`);
    }

    data[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  return { data, content: content.trim() };
}

// Mirrors normalize_tags in the backend's app/notes.py — keep the rules in sync.
function normalizeTags(value) {
  const parts = Array.isArray(value) ? value : (value || "").split(",");
  const tags = [];

  for (const part of parts) {
    const tag = String(part).trim().toLowerCase().split(/\s+/).filter(Boolean).join("-");
    if (tag && !tags.includes(tag)) tags.push(tag);
  }

  return tags;
}

async function findHtmlFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);

      if (entry.isDirectory()) {
        return findHtmlFiles(entryPath);
      }

      return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
    })
  );

  return files.flat().sort();
}

async function loadLocalNotes() {
  const notesRoot = path.resolve(process.cwd(), "..", "omarmassfih.no-backend", "notes");
  const files = await findHtmlFiles(notesRoot);

  return Promise.all(
    files.map(async (file) => {
      const { data, content } = parseFrontMatter(await readFile(file, "utf8"), file);
      const slug = path.relative(notesRoot, file).replace(/\.html$/, "").split(path.sep).join("/");
      const title = data.title;

      return normalizeNote({
        slug,
        url: `/notes/${slug}.html`,
        title,
        heading: data.heading || title,
        list_title: data.listTitle || title,
        description: data.description || null,
        lang: data.lang || "en",
        category: data.category || "Notes",
        date: data.date || "",
        date_text: data.dateText || "",
        content_html: content,
        tags: data.tags,
      });
    })
  );
}

function normalizeNote(note) {
  const date = note.date || new Date().toISOString().slice(0, 10);

  return {
    ...note,
    date,
    date_iso: new Date(`${date}T00:00:00.000Z`).toISOString(),
    tags: normalizeTags(note.tags),
  };
}

async function loadBackendNotes() {
  const backendUrl = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;
  // Bust the API edge cache (Cache-Control s-maxage=300) so a build always
  // reads freshly seeded notes. The backend dispatches this rebuild right after
  // writing to the database, which can be sooner than the cache would refresh
  // on its own, so a plain request risks building from a stale note list. The
  // unique query param makes the CDN miss its cache and read from origin; the
  // /notes route ignores unknown params.
  const url = `${backendUrl}/notes?include=content&fresh=${Date.now()}`;
  const response = await fetch(url, { headers: { "Cache-Control": "no-cache" } });

  if (!response.ok) {
    throw new Error(`Backend notes request failed with ${response.status}`);
  }

  const notes = await response.json();

  return notes.map(normalizeNote);
}

export default async function () {
  let notes;

  try {
    notes = await loadBackendNotes();
  } catch (backendError) {
    console.warn(`[backendNotes] Backend fetch failed (${backendError.message}), trying local notes`);

    notes = await loadLocalNotes();
  }

  notes.sort((left, right) => right.date.localeCompare(left.date));

  return notes;
}
