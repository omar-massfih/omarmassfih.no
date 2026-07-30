import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";
import buildFeaturedWork, {
  ENGINEERING_CASE_STUDY_URL,
} from "../lib/featuredWork.js";
import loadBackendNotes from "../lib/notesLoader.js";

const errors = [];
const outputPath = path.resolve("_site/index.html");
const projects = JSON.parse(fs.readFileSync("src/_data/projects.json", "utf8"));

function normalizedText(element) {
  return element?.textContent.trim().replace(/\s+/g, " ") || "";
}

if (!fs.existsSync(outputPath)) {
  console.error("Featured-work verification failed:\n- Missing _site/index.html.");
  process.exit(1);
}

let notes = [];
try {
  notes = await loadBackendNotes();
} catch (error) {
  errors.push(`Could not load normalized backend note data: ${error.message}`);
}

const expected = buildFeaturedWork(projects, notes);
const document = new JSDOM(fs.readFileSync(outputPath, "utf8")).window.document;
const sections = [...document.querySelectorAll("section.featured-work")];

if (sections.length !== 1) {
  errors.push(`Expected exactly one Featured work section; found ${sections.length}.`);
}

const section = sections[0];
if (section) {
  const sectionHeading = section.querySelector(":scope > .section-head > h2");
  if (normalizedText(sectionHeading) !== "Featured work") {
    errors.push("Featured work is missing its level-two section heading.");
  }
  if (
    section.getAttribute("aria-labelledby") !== sectionHeading?.id ||
    !sectionHeading?.id
  ) {
    errors.push("Featured work is not labelled by its visible heading.");
  }

  const groupHeadings = [...section.querySelectorAll(".featured-work-group > .featured-work-group-head > h3")]
    .map(normalizedText);
  if (JSON.stringify(groupHeadings) !== JSON.stringify(["Featured projects", "Latest notes"])) {
    errors.push("Featured work does not have the expected level-three subsection headings.");
  }
  if (section.querySelectorAll(".featured-card > h4").length !==
      section.querySelectorAll(".featured-card").length) {
    errors.push("Every featured card must have a level-four heading.");
  }
}

const projectCards = [...(document
  .querySelector("#featured-projects-title")
  ?.closest(".featured-work-group")
  ?.querySelectorAll(".featured-work-cards .featured-card") || [])];
if (projectCards.length !== expected.projects.length) {
  errors.push(`Expected ${expected.projects.length} featured projects; found ${projectCards.length}.`);
}

for (const [index, project] of expected.projects.entries()) {
  const card = projectCards[index];
  if (!card) continue;

  const link = card.querySelector("h4 > a");
  if (link?.getAttribute("href") !== project.url) {
    errors.push(`Project "${project.name}" does not use its canonical URL.`);
  }
  if (normalizedText(link) !== project.name) {
    errors.push(`Project card ${index + 1} does not render the expected name.`);
  }
  if (normalizedText(card.querySelector(".featured-card-kicker")) !== project.source) {
    errors.push(`Project "${project.name}" does not render its source.`);
  }
  const summary = [...card.children].find(
    (element) => element.tagName === "P" && !element.classList.contains("featured-card-kicker")
  );
  if (normalizedText(summary) !== project.summary) {
    errors.push(`Project "${project.name}" does not render its summary.`);
  }

  const tagList = card.querySelector(".tag-list");
  const tags = [...card.querySelectorAll(".tag-list > .tag")].map(normalizedText);
  if (project.tags?.length) {
    if (
      tagList?.getAttribute("aria-label") !== "Technologies" ||
      JSON.stringify(tags) !== JSON.stringify(project.tags)
    ) {
      errors.push(`Project "${project.name}" has incorrect or unlabelled technologies.`);
    }
  } else if (tagList) {
    errors.push(`Project "${project.name}" rendered an empty technology list.`);
  }
}

const renderedProjectUrls = projectCards
  .map((card) => card.querySelector("h4 > a")?.getAttribute("href"))
  .filter(Boolean);
if (new Set(renderedProjectUrls).size !== renderedProjectUrls.length) {
  errors.push("Featured projects contain a duplicate URL.");
}
for (const project of projects.filter(({ draft }) => draft)) {
  if (renderedProjectUrls.includes(project.url)) {
    errors.push(`Draft project "${project.name}" was featured.`);
  }
}

const noteCards = [...(document
  .querySelector("#featured-notes-title")
  ?.closest(".featured-work-group")
  ?.querySelectorAll(".featured-work-cards .featured-card") || [])];
if (noteCards.length !== expected.notes.length) {
  errors.push(`Expected ${expected.notes.length} featured notes; found ${noteCards.length}.`);
}

for (const [index, note] of expected.notes.entries()) {
  const card = noteCards[index];
  if (!card) continue;

  const link = card.querySelector("h4 > a");
  const expectedTitle = note.list_title || note.title;
  if (link?.getAttribute("href") !== note.url || normalizedText(link) !== expectedTitle) {
    errors.push(`Note card ${index + 1} does not render "${expectedTitle}" at its canonical URL.`);
  }

  const description = String(note.description || "").trim();
  const renderedDescription = card.querySelector(".featured-note-description");
  if (description) {
    if (normalizedText(renderedDescription) !== description.replace(/\s+/g, " ")) {
      errors.push(`${note.url}: Description does not match normalized note data.`);
    }
  } else if (renderedDescription) {
    errors.push(`${note.url}: Empty description rendered markup.`);
  }

  const time = card.querySelector(".featured-note-meta time");
  if (
    time?.getAttribute("datetime") !== note.date_iso ||
    normalizedText(time) !== (note.date_text || "")
  ) {
    errors.push(`${note.url}: Date is not rendered with matching time metadata.`);
  }
  const readingTimeText = String(note.reading_time_text || "").trim();
  const readingTimeLabels = [...card.querySelectorAll(
    ".featured-note-meta > span:not([aria-hidden])"
  )];
  if (readingTimeText) {
    if (
      readingTimeLabels.length !== 1 ||
      normalizedText(readingTimeLabels[0]) !== readingTimeText
    ) {
      errors.push(`${note.url}: Reading-time label does not match normalized note data.`);
    }
  } else if (readingTimeLabels.length) {
    errors.push(`${note.url}: Empty reading time rendered markup.`);
  }

  const tagList = card.querySelector(".tag-list");
  const tags = [...card.querySelectorAll(".tag-list > .tag")].map(normalizedText);
  if (note.tags?.length) {
    if (
      tagList?.getAttribute("aria-label") !== "Tags" ||
      JSON.stringify(tags) !== JSON.stringify(note.tags)
    ) {
      errors.push(`${note.url}: Tags are incorrect or lack an accessible label.`);
    }
  } else if (tagList) {
    errors.push(`${note.url}: Untagged note rendered an empty tag list.`);
  }
}

const requiredLinks = [
  [ENGINEERING_CASE_STUDY_URL, "Read the engineering case study"],
  ["/projects.html", "View all projects"],
  ["/notes.html", "View all notes"],
];
for (const [url, label] of requiredLinks) {
  const link = [...(section?.querySelectorAll(`a[href="${url}"]`) || [])]
    .find((candidate) => normalizedText(candidate) === label);
  if (!link) errors.push(`Missing "${label}" link to ${url}.`);
}

for (const card of section?.querySelectorAll(".featured-card") || []) {
  if (card.querySelector("a a")) errors.push("A featured card contains nested anchors.");
  for (const list of card.querySelectorAll(".tag-list")) {
    if (!list.children.length) errors.push("A featured card contains an empty tag list.");
    if (!list.getAttribute("aria-label")) errors.push("A tag list lacks an accessible label.");
  }
}

if (errors.length) {
  console.error("Featured-work verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Verified deterministic featured projects and notes, metadata, links, and accessibility.");
