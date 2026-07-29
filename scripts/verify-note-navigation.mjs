import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";

const siteDir = path.resolve("_site");
const notesDir = path.join(siteDir, "notes");
const errors = [];

function walkHtmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkHtmlFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
  });
}

function pageUrl(filePath) {
  return `/${path.relative(siteDir, filePath).split(path.sep).join("/")}`;
}

function hrefToFile(href) {
  const relativePath = href.replace(/^\/+/, "");
  return path.join(siteDir, relativePath.endsWith("/") ? `${relativePath}index.html` : relativePath);
}

const indexPath = path.join(siteDir, "notes.html");
if (!fs.existsSync(indexPath)) {
  errors.push("Generated notes index _site/notes.html is missing.");
}

const categories = new Map();
if (fs.existsSync(indexPath)) {
  const indexDocument = new JSDOM(fs.readFileSync(indexPath, "utf8")).window.document;
  const list = indexDocument.querySelector(".notes-list");
  let currentCategory = null;

  for (const child of list?.children || []) {
    const heading = child.matches(".notes-head") ? child.querySelector("h2") : null;
    if (heading) {
      currentCategory = heading.textContent.trim();
      if (categories.has(currentCategory)) {
        errors.push(`Notes index repeats category heading "${currentCategory}".`);
      } else {
        categories.set(currentCategory, []);
      }
      continue;
    }

    if (!child.matches("a.list-row[data-category]")) continue;
    const rowCategory = child.dataset.category;
    const href = child.getAttribute("href");
    if (!currentCategory || rowCategory !== currentCategory) {
      errors.push(`Notes index row ${href} is not under its "${rowCategory}" category heading.`);
      continue;
    }
    categories.get(currentCategory).push(href);
  }
}

const noteFiles = walkHtmlFiles(notesDir);
const generatedUrls = new Set(noteFiles.map(pageUrl));
const listedUrls = new Set([...categories.values()].flat());

if (!noteFiles.length) errors.push("No generated note HTML files found under _site/notes.");
for (const url of listedUrls) {
  if (!generatedUrls.has(url)) errors.push(`Listed note has no generated page: ${url}`);
}
for (const url of generatedUrls) {
  if (!listedUrls.has(url)) errors.push(`Generated note page is missing from the notes index: ${url}`);
}

for (const [category, urls] of categories) {
  for (const [index, currentUrl] of urls.entries()) {
    const file = hrefToFile(currentUrl);
    if (!fs.existsSync(file)) continue;

    const document = new JSDOM(fs.readFileSync(file, "utf8")).window.document;
    const navs = [...document.querySelectorAll("nav.note-navigation")];
    if (navs.length !== 1) {
      errors.push(`${currentUrl}: Expected exactly one note navigation landmark, found ${navs.length}.`);
      continue;
    }

    const nav = navs[0];
    const label = nav.getAttribute("aria-label");
    if (!label || label !== `Notes in ${category}`) {
      errors.push(`${currentUrl}: Navigation accessible label does not identify "${category}".`);
    }

    const position = nav.querySelector(".note-navigation-position")?.textContent.trim();
    const expectedPosition = `${index + 1} of ${urls.length} in ${category}`;
    if (position !== expectedPosition) {
      errors.push(`${currentUrl}: Expected position "${expectedPosition}", found "${position || ""}".`);
    }

    const previousLinks = [...nav.querySelectorAll("a.note-navigation-previous")];
    const nextLinks = [...nav.querySelectorAll("a.note-navigation-next")];
    const expectedPrevious = index > 0 ? urls[index - 1] : null;
    const expectedNext = index < urls.length - 1 ? urls[index + 1] : null;

    for (const [direction, links, expected] of [
      ["previous", previousLinks, expectedPrevious],
      ["next", nextLinks, expectedNext],
    ]) {
      if (links.length !== (expected ? 1 : 0)) {
        errors.push(`${currentUrl}: Expected ${expected ? "one" : "no"} ${direction} link.`);
        continue;
      }
      if (expected && links[0].getAttribute("href") !== expected) {
        errors.push(`${currentUrl}: ${direction} link must target adjacent note ${expected}.`);
      }
    }

    for (const link of nav.querySelectorAll("a")) {
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("/notes/") || href.includes("?") || href.includes("#")) {
        errors.push(`${currentUrl}: Navigation link is not an absolute canonical /notes/ URL: ${href}`);
      } else if (href === currentUrl) {
        errors.push(`${currentUrl}: Navigation links to itself.`);
      } else if (!fs.existsSync(hrefToFile(href))) {
        errors.push(`${currentUrl}: Navigation target does not exist: ${href}`);
      }
    }
  }
}

if (errors.length) {
  console.error("Note navigation verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Verified category navigation in ${noteFiles.length} generated note pages.`);
