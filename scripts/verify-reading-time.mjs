import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";

const siteDir = path.resolve("_site");
const notesIndexFile = path.join(siteDir, "notes.html");
const notesDir = path.join(siteDir, "notes");
const errors = [];
const readingTimePattern = /\b\d+ min read\b/;

function walkHtmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkHtmlFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
  });
}

function normalizedText(element) {
  return element?.textContent.trim().replace(/\s+/g, " ") || "";
}

function pageUrl(filePath) {
  const relativePath = path.relative(siteDir, filePath).split(path.sep).join("/");
  return `/${relativePath}`.replace(/(^|\/)index\.html$/, "$1");
}

if (!fs.existsSync(notesIndexFile)) {
  errors.push("_site/notes.html is missing.");
}

const listLabelsByUrl = new Map();
if (fs.existsSync(notesIndexFile)) {
  const document = new JSDOM(fs.readFileSync(notesIndexFile, "utf8")).window.document;
  const rows = [...document.querySelectorAll(".notes-list a.list-row")];

  if (!rows.length) errors.push("/notes.html: No generated note rows found.");

  for (const row of rows) {
    const labels = row.querySelectorAll(".list-row-meta");
    const label = normalizedText(labels[0]);
    if (labels.length !== 1 || !readingTimePattern.test(label)) {
      errors.push(`/notes.html: ${row.getAttribute("href")} must have one static reading-time label.`);
    }
    listLabelsByUrl.set(row.getAttribute("href"), label);
  }
}

const noteFiles = walkHtmlFiles(notesDir);
if (!noteFiles.length) errors.push("No generated note HTML files found under _site/notes.");

for (const file of noteFiles) {
  const document = new JSDOM(fs.readFileSync(file, "utf8")).window.document;
  const url = pageUrl(file);
  const labels = document.querySelectorAll("main.note > section:first-child > .note-meta");
  const label = normalizedText(labels[0]);

  if (labels.length !== 1 || !readingTimePattern.test(label) || !label.includes(" · ")) {
    errors.push(`${url}: Expected exactly one static date and reading-time metadata label.`);
  }

  const listLabel = listLabelsByUrl.get(url);
  if (!listLabel) {
    errors.push(`${url}: No matching row found on /notes.html.`);
  } else if (listLabel !== label) {
    errors.push(`${url}: Reading metadata differs from its /notes.html row.`);
  }
}

if (errors.length) {
  console.error("Reading-time verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Verified static reading-time metadata in ${noteFiles.length} note pages and ${listLabelsByUrl.size} list rows.`
);
