import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";
import loadBackendNotes from "../lib/notesLoader.js";
import buildLearningPaths from "../lib/learningPaths.js";

const siteRoot = path.resolve("_site");
const pageUrl = "/learning-paths.html";
const errors = [];
const outputFile = (url) => path.join(siteRoot, url.replace(/^\//, ""));
const text = (element) => element?.textContent.trim().replace(/\s+/g, " ") || "";
const count = (values, expected) => values.filter((value) => value === expected).length;

let notes = [];
let paths = [];
try {
  notes = await loadBackendNotes();
  paths = buildLearningPaths(notes);
} catch (error) {
  errors.push(`Could not derive learning paths from published notes: ${error.message}`);
}

const publishedUrls = new Set(
  notes.filter((note) => note.published !== false).map((note) => note.url)
);
const pageFile = outputFile(pageUrl);
const document = fs.existsSync(pageFile)
  ? new JSDOM(fs.readFileSync(pageFile, "utf8")).window.document
  : null;

if (!document) {
  errors.push("_site/learning-paths.html is missing.");
} else {
  const renderedPaths = [...document.querySelectorAll("main .learning-path")];
  if (renderedPaths.length !== paths.length) {
    errors.push(`Expected ${paths.length} track sections, found ${renderedPaths.length}.`);
  }

  const renderedSlugs = renderedPaths.map((section) => section.id);
  if (JSON.stringify(renderedSlugs) !== JSON.stringify(paths.map((item) => item.slug))) {
    errors.push("Learning path order does not match the curated configuration.");
  }

  for (const expected of paths) {
    const sections = renderedPaths.filter((section) => section.id === expected.slug);
    if (sections.length !== 1) {
      errors.push(`Expected path "${expected.slug}" exactly once, found ${sections.length}.`);
      continue;
    }

    const section = sections[0];
    if (text(section.querySelector("h2")) !== expected.title) {
      errors.push(`Path "${expected.slug}" has the wrong heading.`);
    }
    if (text(section.querySelector(".learning-path-head > p")) !== expected.description) {
      errors.push(`Path "${expected.slug}" has the wrong description.`);
    }
    const metadata = text(section.querySelector(".learning-path-meta"));
    const expectedMetadata =
      `${expected.note_count} ${expected.note_count === 1 ? "note" : "notes"} · ` +
      expected.total_reading_time_text;
    if (metadata !== expectedMetadata) {
      errors.push(`Path "${expected.slug}" metadata should be "${expectedMetadata}".`);
    }

    const list = section.querySelector("ol.learning-path-steps");
    if (!list) {
      errors.push(`Path "${expected.slug}" does not use an ordered list.`);
      continue;
    }
    const links = [...list.querySelectorAll(":scope > li > a.list-row")];
    const urls = links.map((link) => link.getAttribute("href"));
    const expectedUrls = expected.notes.map((note) => note.url);
    if (JSON.stringify(urls) !== JSON.stringify(expectedUrls)) {
      errors.push(`Path "${expected.slug}" note links or order do not match configuration.`);
    }

    for (const note of expected.notes) {
      if (count(urls, note.url) !== 1) {
        errors.push(`Path "${expected.slug}" should link to ${note.url} exactly once.`);
      }
      if (!publishedUrls.has(note.url)) {
        errors.push(`Path "${expected.slug}" includes unpublished URL ${note.url}.`);
      }
      if (!fs.existsSync(outputFile(note.url))) {
        errors.push(`Path "${expected.slug}" target ${note.url} does not exist in _site.`);
      }
    }
    for (const url of urls) {
      if (!expectedUrls.includes(url)) {
        errors.push(`Path "${expected.slug}" contains unconfigured note URL ${url}.`);
      }
    }
  }

  if (document.querySelector("main script, main button, main input")) {
    errors.push("Learning paths require a script or interactive control in the main content.");
  }
}

const notesFile = outputFile("/notes.html");
if (!fs.existsSync(notesFile)) {
  errors.push("_site/notes.html is missing.");
} else {
  const notesDocument = new JSDOM(fs.readFileSync(notesFile, "utf8")).window.document;
  const links = [...notesDocument.querySelectorAll(`a[href="${pageUrl}"]`)]
    .filter((link) => text(link) && !link.closest("[hidden]"));
  if (links.length !== 1) {
    errors.push(`/notes.html should contain one visible link to ${pageUrl}, found ${links.length}.`);
  }
}

const sitemapFile = outputFile("/sitemap.xml");
if (!fs.existsSync(sitemapFile)) {
  errors.push("_site/sitemap.xml is missing.");
} else {
  const sitemap = fs.readFileSync(sitemapFile, "utf8");
  const site = JSON.parse(fs.readFileSync("src/_data/site.json", "utf8"));
  const fullUrl = `${site.url}${pageUrl}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = sitemap.match(new RegExp(`<loc>${fullUrl}</loc>`, "g")) || [];
  if (matches.length !== 1) {
    errors.push(`${pageUrl}: sitemap contains ${matches.length} entries instead of one.`);
  }
}

if (errors.length) {
  console.error("Learning-path verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Verified ${paths.length} learning paths, ` +
    `${paths.reduce((total, item) => total + item.note_count, 0)} note links, targets, and sitemap.`
);
