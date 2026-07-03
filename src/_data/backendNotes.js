import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BACKEND_URL = "https://backend.omarmassfih.no";

function parseFrontMatter(raw, sourcePath) {
  if (!raw.startsWith("---\n")) {
    throw new Error(`${sourcePath} is missing front matter`);
  }

  const [, frontMatter, content] = raw.split("---", 3);
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
  };
}

async function loadBackendNotes() {
  const backendUrl = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;
  const response = await fetch(`${backendUrl}/notes`);

  if (!response.ok) {
    throw new Error(`Backend notes request failed with ${response.status}`);
  }

  const summaries = await response.json();

  return Promise.all(
    summaries.map(async (summary) => {
      const detailResponse = await fetch(`${backendUrl}/notes/${summary.slug}`);

      if (!detailResponse.ok) {
        throw new Error(`Backend note ${summary.slug} failed with ${detailResponse.status}`);
      }

      return normalizeNote(await detailResponse.json());
    })
  );
}

export default async function () {
  let notes;

  try {
    notes = await loadBackendNotes();
  } catch (error) {
    console.warn(`Falling back to local notes: ${error.message}`);
    notes = await loadLocalNotes();
  }

  return notes.sort((left, right) => right.date.localeCompare(left.date));
}
