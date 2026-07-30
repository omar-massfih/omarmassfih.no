import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";
import loadBackendNotes from "../lib/notesLoader.js";

const notesIndexFile = path.resolve("_site/notes.html");
const errors = [];

function normalizedText(element) {
  return element?.textContent.trim().replace(/\s+/g, " ") || "";
}

if (!fs.existsSync(notesIndexFile)) {
  console.error("Note-preview verification failed:\n- _site/notes.html is missing.");
  process.exit(1);
}

const document = new JSDOM(fs.readFileSync(notesIndexFile, "utf8")).window.document;
const rows = [...document.querySelectorAll(".notes-list > a.list-row")];
let notes = [];

if (!rows.length) errors.push("No generated note rows found.");
try {
  notes = await loadBackendNotes();
} catch (error) {
  errors.push(`Could not load normalized backend note data: ${error.message}`);
}

const filter = document.querySelector(".notes-filter");
if (!filter?.hasAttribute("hidden")) {
  errors.push("The filter controls must be initially hidden for progressive enhancement.");
}
if (!document.querySelector("main.notes-index > .notes-intro")) {
  errors.push("The notes index must include its page-specific introduction.");
}
if (!filter?.querySelector('label[for="notes-search-input"]')) {
  errors.push("The notes search must have a visible associated label.");
}

const categoryHeaders = [...document.querySelectorAll(".notes-list > .notes-head")];
for (const header of categoryHeaders) {
  if (!header.querySelector(".category-note-count")) {
    errors.push(`${normalizedText(header.querySelector("h2"))}: Category heading is missing its note count.`);
  }
}

const cssPath = path.resolve("_site/style.css");
if (!fs.existsSync(cssPath)) {
  errors.push("Built stylesheet is missing.");
} else {
  const css = fs.readFileSync(cssPath, "utf8");
  if (!/\.tag\s*\{[^}]*text-decoration:\s*none\s*;/s.test(css)) {
    errors.push("Tag pills must not inherit link underlines.");
  }
}

const emptyState = document.querySelector(".notes-list > .notes-empty");
if (!emptyState?.hasAttribute("hidden")) {
  errors.push("The empty state must exist and be initially hidden.");
}

const rowsByUrl = new Map();
for (const row of rows) {
  const url = row.getAttribute("href");
  if (!url) {
    errors.push("A note row is missing its URL.");
    continue;
  }
  if (rowsByUrl.has(url)) errors.push(`${url}: Duplicate note row URL.`);
  rowsByUrl.set(url, row);

  if (row.querySelectorAll(".list-row-title").length !== 1) {
    errors.push(`${url}: Expected exactly one title.`);
  }
  if (row.querySelectorAll(".list-row-meta").length !== 1) {
    errors.push(`${url}: Expected exactly one date/reading-time metadata element.`);
  }
  if (row.querySelector("a")) {
    errors.push(`${url}: Preview content must not contain a nested link.`);
  }
}

for (const note of notes) {
  const row = rowsByUrl.get(note.url);
  if (!row) {
    errors.push(`${note.url}: No matching generated row.`);
    continue;
  }

  const description = String(note.description || "").trim();
  const descriptions = row.querySelectorAll(".note-preview-description");
  if (description) {
    if (descriptions.length !== 1 || normalizedText(descriptions[0]) !== description.replace(/\s+/g, " ")) {
      errors.push(`${note.url}: Static description does not match its source metadata.`);
    }
  } else if (descriptions.length) {
    errors.push(`${note.url}: Empty source description rendered preview markup.`);
  }

  const expectedTags = Array.isArray(note.tags) ? note.tags : [];
  const tagLists = row.querySelectorAll(".note-preview-tags");
  const renderedTags = [...row.querySelectorAll(".note-preview-tags > .tag")].map(normalizedText);
  if (expectedTags.length) {
    if (tagLists.length !== 1 || JSON.stringify(renderedTags) !== JSON.stringify(expectedTags)) {
      errors.push(`${note.url}: Static tags do not match their source metadata.`);
    }
  } else if (tagLists.length) {
    errors.push(`${note.url}: Untagged note rendered an empty tag list.`);
  }
}

for (const url of rowsByUrl.keys()) {
  if (!notes.some((note) => note.url === url)) {
    errors.push(`${url}: Generated row has no matching source metadata.`);
  }
}

if (errors.length) {
  console.error("Note-preview verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Verified ${rows.length} static note previews, their URLs, descriptions, and tags.`);
