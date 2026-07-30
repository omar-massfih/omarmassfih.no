import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";
import buildProjectExplorer from "../lib/projectExplorer.js";

const errors = [];
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const indexPath = path.resolve("_site/search-index.json");

let index = [];
if (!fs.existsSync(indexPath)) {
  errors.push("Missing _site/search-index.json.");
} else {
  try {
    index = readJson(indexPath);
    if (!Array.isArray(index)) {
      errors.push("Search index is not an array.");
      index = [];
    }
  } catch {
    errors.push("Search index is not valid JSON.");
  }
}

const projects = readJson("src/_data/projects.json");
const cv = readJson("src/_data/cv.json");
const byType = (type) => index.filter((record) => record.type === type);

const notesOutputPath = path.resolve("_site/notes.html");
let backendNotes = [];
if (!fs.existsSync(notesOutputPath)) {
  errors.push("Missing _site/notes.html.");
} else {
  const notesDocument = new JSDOM(fs.readFileSync(notesOutputPath, "utf8")).window.document;
  const notesData = notesDocument.querySelector("#notes-search-data")?.textContent;
  if (!notesData) {
    errors.push("Missing backend note data in _site/notes.html.");
  } else {
    try {
      backendNotes = JSON.parse(notesData);
      if (!Array.isArray(backendNotes)) errors.push("Backend note data is not an array.");
    } catch {
      errors.push("Backend note data is not valid JSON.");
    }
  }
}

const noteIdentity = ({ title, url }) => JSON.stringify([title, url]);
if (byType("note").length !== backendNotes.length) {
  errors.push(`Expected ${backendNotes.length} note records; found ${byType("note").length}.`);
}
const expectedNotes = new Set(backendNotes.map(noteIdentity));
const actualNoteIdentities = byType("note").map(noteIdentity);
const actualNotes = new Set(actualNoteIdentities);
for (const identity of expectedNotes) {
  if (!actualNotes.has(identity)) {
    const [title, url] = JSON.parse(identity);
    errors.push(`Missing note "${title}" (${url}).`);
  }
}
for (const identity of actualNotes) {
  if (!expectedNotes.has(identity)) {
    const [title, url] = JSON.parse(identity);
    errors.push(`Unexpected note "${title}" (${url}).`);
  }
}
for (const identity of actualNotes) {
  const count = actualNoteIdentities.filter((candidate) => candidate === identity).length;
  if (count > 1) {
    const [title, url] = JSON.parse(identity);
    errors.push(`Duplicate note "${title}" (${url}) appears ${count} times.`);
  }
}

const publishedProjects = buildProjectExplorer(projects).projects;
if (byType("project").length !== publishedProjects.length) {
  errors.push(`Expected ${publishedProjects.length} project records; found ${byType("project").length}.`);
}
for (const project of publishedProjects) {
  const found = byType("project").find(({ title }) => title === project.name);
  if (!found) errors.push(`Missing published project "${project.name}".`);
  else if (found.url !== project.url) errors.push(`Project "${project.name}" has the wrong URL.`);
}
for (const project of projects.filter(({ draft }) => draft)) {
  if (index.some(({ title }) => title === project.name)) {
    errors.push(`Draft project "${project.name}" appears in the search index.`);
  }
}

const uniqueSkills = new Set(
  cv.skills.flatMap(({ items }) => items).map((item) => item.toLowerCase())
);
if (byType("skill").length !== uniqueSkills.size) {
  errors.push(`Expected ${uniqueSkills.size} unique skill records; found ${byType("skill").length}.`);
}

for (const record of index) {
  if (!["note", "project", "skill"].includes(record.type)) errors.push("Unsupported record type.");
  if (!record.title || !record.url || !record.searchText) {
    errors.push(`Incomplete search record: ${JSON.stringify(record)}.`);
  }
}

if (!fs.existsSync(path.resolve("_site/site-search.js"))) {
  errors.push("Missing built site-search.js asset.");
}

for (const page of ["index.html", "projects.html", "notes.html", "cv.html", "about.html"]) {
  const output = path.resolve("_site", page);
  if (!fs.existsSync(output)) {
    errors.push(`Missing generated ${page}.`);
    continue;
  }
  const document = new JSDOM(fs.readFileSync(output, "utf8")).window.document;
  const trigger = document.querySelector("#site-search-trigger[hidden][aria-label='Search site']");
  const dialog = document.querySelector("#site-search-dialog[aria-labelledby='site-search-title']");
  const status = document.querySelector("#site-search-status[aria-live='polite'][aria-atomic='true']");
  const script = document.querySelector('script[src^="/site-search.js?v="][defer]');
  if (!trigger) errors.push(`${page}: missing accessible hidden search trigger.`);
  if (!dialog) errors.push(`${page}: missing labeled search dialog.`);
  if (!status) errors.push(`${page}: missing search live region.`);
  if (!script) errors.push(`${page}: missing deferred hashed search script.`);
}

const cvDocument = new JSDOM(fs.readFileSync("_site/cv.html", "utf8")).window.document;
if (!cvDocument.querySelector("#skills")) errors.push("CV page is missing the #skills target.");

if (errors.length) {
  console.error("Site search verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Verified ${index.length} search records, site-wide accessible markup, and client asset.`);
