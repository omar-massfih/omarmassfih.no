import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";
import loadBackendNotes from "../lib/notesLoader.js";
import buildNoteCategories from "../lib/noteCategories.js";

const siteRoot = path.resolve("_site");
const errors = [];
const text = (element) => element?.textContent.trim().replace(/\s+/g, " ") || "";
const outputFile = (url) => path.join(siteRoot, url.replace(/^\//, ""));
const count = (values, expected) => values.filter((value) => value === expected).length;
const sortedUnique = (values) => [...new Set(values)].sort();
const categoryUrlPrefix = "/notes/categories/";

function htmlFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(file);
    return entry.isFile() && entry.name.endsWith(".html") ? [file] : [];
  });
}

let notes = [];
try {
  notes = await loadBackendNotes();
} catch (error) {
  errors.push(`Could not load normalized backend note data: ${error.message}`);
}
const categories = buildNoteCategories(notes);
const expectedCategoryUrls = categories.map((category) => category.url).sort();
const categoryDir = path.join(siteRoot, "notes", "categories");
const generatedFiles = fs.existsSync(categoryDir)
  ? fs.readdirSync(categoryDir).filter((file) => file.endsWith(".html")).sort()
  : [];
const expectedFiles = categories.map((category) => `${category.slug}.html`).sort();

if (JSON.stringify(generatedFiles) !== JSON.stringify(expectedFiles)) {
  errors.push(
    `Generated category files differ: expected ${expectedFiles.join(", ")}, got ${generatedFiles.join(", ")}.`
  );
}

const indexFile = outputFile("/notes.html");
const indexDocument = fs.existsSync(indexFile)
  ? new JSDOM(fs.readFileSync(indexFile, "utf8")).window.document
  : null;
if (!indexDocument) errors.push("_site/notes.html is missing.");

const generatedCategoryLinks = sortedUnique(
  htmlFiles(siteRoot).flatMap((file) => {
    const document = new JSDOM(fs.readFileSync(file, "utf8")).window.document;
    return [...document.querySelectorAll(`a[href^="${categoryUrlPrefix}"]`)]
      .map((link) => link.getAttribute("href"));
  })
);
if (JSON.stringify(generatedCategoryLinks) !== JSON.stringify(expectedCategoryUrls)) {
  errors.push(
    `Generated category links differ: expected ${expectedCategoryUrls.join(", ")}, ` +
      `got ${generatedCategoryLinks.join(", ")}.`
  );
}

for (const category of categories) {
  const file = outputFile(category.url);
  if (!fs.existsSync(file)) {
    errors.push(`${category.url}: category page is missing.`);
    continue;
  }

  const document = new JSDOM(fs.readFileSync(file, "utf8")).window.document;
  if (text(document.querySelector("h1")) !== category.title) {
    errors.push(`${category.url}: heading does not match "${category.title}".`);
  }
  const expectedCount = `${category.count} ${category.count === 1 ? "note" : "notes"}`;
  if (text(document.querySelector(".category-note-count")) !== expectedCount) {
    errors.push(`${category.url}: note count does not match "${expectedCount}".`);
  }

  const previewUrls = [...document.querySelectorAll(".notes-list > a.list-row")]
    .map((row) => row.getAttribute("href"));
  for (const note of category.notes) {
    if (count(previewUrls, note.url) !== 1) {
      errors.push(`${category.url}: expected exactly one preview for ${note.url}.`);
    }
    if (!fs.existsSync(outputFile(note.url))) {
      errors.push(`${category.url}: preview target ${note.url} does not exist.`);
    }
  }
  for (const url of previewUrls) {
    if (!category.notes.some((note) => note.url === url)) {
      errors.push(`${category.url}: includes note from another category: ${url}.`);
    }
  }

  const indexLinks = indexDocument
    ? [...indexDocument.querySelectorAll(`a[href="${category.url}"]`)]
    : [];
  if (!indexLinks.length) errors.push(`/notes.html does not link to ${category.url}.`);
  if (!fs.existsSync(file)) errors.push(`/notes.html category link ${category.url} does not resolve.`);

  for (const note of category.notes) {
    const noteFile = outputFile(note.url);
    if (!fs.existsSync(noteFile)) continue;
    const noteDocument = new JSDOM(fs.readFileSync(noteFile, "utf8")).window.document;
    if (!noteDocument.querySelector(`a[href="${category.url}"]`)) {
      errors.push(`${note.url}: does not link to its category ${category.url}.`);
    }
  }
}

const sitemapFile = outputFile("/sitemap.xml");
if (!fs.existsSync(sitemapFile)) {
  errors.push("_site/sitemap.xml is missing.");
} else {
  const sitemap = fs.readFileSync(sitemapFile, "utf8");
  const site = JSON.parse(fs.readFileSync("src/_data/site.json", "utf8"));
  const categorySitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith(`${site.url}${categoryUrlPrefix}`))
    .map((url) => url.slice(site.url.length));
  const uniqueCategorySitemapUrls = sortedUnique(categorySitemapUrls);
  if (JSON.stringify(uniqueCategorySitemapUrls) !== JSON.stringify(expectedCategoryUrls)) {
    errors.push(
      `Category sitemap entries differ: expected ${expectedCategoryUrls.join(", ")}, ` +
        `got ${uniqueCategorySitemapUrls.join(", ")}.`
    );
  }

  for (const category of categories) {
    const escaped = `${site.url}${category.url}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = sitemap.match(new RegExp(`<loc>${escaped}</loc>`, "g")) || [];
    if (matches.length !== 1) {
      errors.push(`${category.url}: sitemap contains ${matches.length} entries instead of one.`);
    }
  }
}

if (errors.length) {
  console.error("Note-category verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Verified ${categories.length} category pages, ${notes.length} previews, links, and sitemap entries.`
);
