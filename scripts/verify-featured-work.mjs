import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";
import loadBackendNotes from "../lib/notesLoader.js";

const errors = [];
const outputPath = path.resolve("_site/index.html");
const projects = JSON.parse(fs.readFileSync("src/_data/projects.json", "utf8"));

function normalizedText(element) {
  return element?.textContent.trim().replace(/\s+/g, " ") || "";
}

if (!fs.existsSync(outputPath)) {
  console.error("Homepage work verification failed:\n- Missing _site/index.html.");
  process.exit(1);
}

let notes = [];
try {
  notes = await loadBackendNotes();
} catch (error) {
  errors.push(`Could not load normalized backend note data: ${error.message}`);
}

const document = new JSDOM(fs.readFileSync(outputPath, "utf8")).window.document;
const sections = [...document.querySelectorAll("main > article")];
const [projectSection, noteSection] = sections;
const publishedProjects = projects.filter(({ draft }) => !draft).slice(0, 2);
const latestNotes = notes.slice(0, 2);

if (sections.length < 2) errors.push("Expected compact project and note sections on the homepage.");
if (normalizedText(projectSection?.querySelector("h2")) !== "Latest projects") {
  errors.push("Homepage is missing the Latest projects heading.");
}
if (normalizedText(noteSection?.querySelector("h2")) !== "Latest notes") {
  errors.push("Homepage is missing the Latest notes heading.");
}

const projectRows = [...(projectSection?.querySelectorAll(".list-row") || [])];
if (projectRows.length !== publishedProjects.length) {
  errors.push(`Expected ${publishedProjects.length} project rows; found ${projectRows.length}.`);
}
for (const [index, project] of publishedProjects.entries()) {
  const row = projectRows[index];
  if (!row) continue;
  if (row.getAttribute("href") !== project.url) {
    errors.push(`Project "${project.name}" does not use its canonical URL.`);
  }
  if (normalizedText(row.querySelector(".list-row-title")) !== project.name) {
    errors.push(`Project row ${index + 1} does not render the expected name.`);
  }
  if (normalizedText(row.querySelector(".list-row-meta")) !== project.source) {
    errors.push(`Project "${project.name}" does not render its source.`);
  }
}

const noteRows = [...(noteSection?.querySelectorAll(".list-row") || [])];
if (noteRows.length !== latestNotes.length) {
  errors.push(`Expected ${latestNotes.length} note rows; found ${noteRows.length}.`);
}
for (const [index, note] of latestNotes.entries()) {
  const row = noteRows[index];
  if (!row) continue;
  const expectedTitle = note.list_title || note.title;
  if (row.getAttribute("href") !== note.url) {
    errors.push(`Note "${expectedTitle}" does not use its canonical URL.`);
  }
  if (normalizedText(row.querySelector(".list-row-title")) !== expectedTitle) {
    errors.push(`Note row ${index + 1} does not render "${expectedTitle}".`);
  }
  if (normalizedText(row.querySelector(".list-row-meta")) !== (note.date_text || "")) {
    errors.push(`${note.url}: Date label does not match normalized note data.`);
  }
}

for (const [url, label] of [
  ["/projects.html", "Show more"],
  ["/notes.html", "Show more"],
]) {
  const link = [...document.querySelectorAll(`a[href="${url}"]`)]
    .find((candidate) => normalizedText(candidate) === label);
  if (!link) errors.push(`Missing "${label}" link to ${url}.`);
}

for (const row of document.querySelectorAll("main > article .list-row")) {
  if (row.querySelector("a")) errors.push("A homepage list row contains nested anchors.");
}

if (errors.length) {
  console.error("Homepage work verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Verified compact homepage project and note rows, metadata, and links.");
