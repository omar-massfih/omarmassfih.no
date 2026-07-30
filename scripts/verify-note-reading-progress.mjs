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
    if (entry.isDirectory() && entry.name === "categories") return [];
    if (entry.isDirectory()) return walkHtmlFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
  });
}

const noteFiles = walkHtmlFiles(notesDir);
if (!noteFiles.length) errors.push("No generated note pages found under _site/notes.");
if (!fs.existsSync(path.join(siteDir, "note-reading-progress.js"))) {
  errors.push("_site/note-reading-progress.js was not emitted.");
}

for (const file of noteFiles) {
  const document = new JSDOM(fs.readFileSync(file, "utf8")).window.document;
  const page = `/${path.relative(siteDir, file).split(path.sep).join("/")}`;
  const scripts = document.querySelectorAll('script[src^="/note-reading-progress.js?v="]');
  const content = document.querySelector("[data-note-content]");
  const toc = document.querySelector(".note-toc");

  if (scripts.length !== 1) {
    errors.push(`${page}: Expected one cache-busted reading-progress script, found ${scripts.length}.`);
  }
  if (!content) {
    errors.push(`${page}: Missing note-content boundary.`);
    continue;
  }
  if (content.querySelector(".note-navigation, .related-notes, .graph-section, footer")) {
    errors.push(`${page}: Non-note content appears inside the reading boundary.`);
  }

  const headings = [...content.querySelectorAll("h2[id], h3[id]")];
  if (!headings.length) {
    if (toc) errors.push(`${page}: Heading-free note contains an orphaned TOC.`);
    if (document.querySelector("[data-note-reading-progress]")) {
      errors.push(`${page}: Heading-free note contains an orphaned progress indicator.`);
    }
    continue;
  }

  if (document.querySelectorAll(".note-toc").length !== 1) {
    errors.push(`${page}: Expected exactly one note TOC.`);
    continue;
  }

  const progress = toc.querySelector("[data-note-reading-progress]");
  if (!progress || !progress.hidden || !progress.querySelector("progress[max='100'][value='0']")) {
    errors.push(`${page}: Missing hidden, zero-valued semantic progress indicator.`);
  }
  if (toc.querySelector("[aria-current], .is-current")) {
    errors.push(`${page}: Static output contains client-only current-section state.`);
  }

  const links = [...toc.querySelectorAll("[data-note-toc-link]")];
  const linkTargets = links.map((link) => {
    const href = link.getAttribute("href") || "";
    if (!href.startsWith("#")) {
      errors.push(`${page}: TOC link is not a same-page fragment: ${href}`);
      return "";
    }
    try {
      return decodeURIComponent(href.slice(1));
    } catch {
      errors.push(`${page}: TOC link has an invalid encoded fragment: ${href}`);
      return "";
    }
  });
  if (JSON.stringify(linkTargets) !== JSON.stringify(headings.map(({ id }) => id))) {
    errors.push(`${page}: TOC links do not match body heading IDs and order.`);
  }
}

if (errors.length) {
  console.error("Note reading-progress verification failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Verified reading-progress output across ${noteFiles.length} note pages.`);
