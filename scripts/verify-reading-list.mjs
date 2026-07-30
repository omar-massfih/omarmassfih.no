import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";

const siteDir = path.resolve("_site");
const errors = [];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(target) : entry.name.endsWith(".html") ? [target] : [];
});
const publicUrl = (file) => {
  const relativePath = path.relative(siteDir, file).split(path.sep).join("/");
  return relativePath === "index.html"
    ? "/"
    : `/${relativePath.replace(/\/index\.html$/, "/")}`;
};
const files = walk(siteDir);
let noteCount = 0;

if (!fs.existsSync(path.join(siteDir, "reading-list.js"))) {
  errors.push("_site/reading-list.js was not emitted.");
}

const cssPath = path.join(siteDir, "style.css");
if (!fs.existsSync(cssPath)) {
  errors.push("_site/style.css was not emitted.");
} else {
  const css = fs.readFileSync(cssPath, "utf8");
  if (!/\.reading-list-shell\s*\{[^}]*right:\s*calc\(var\(--chat-offset-x\)\s*\+\s*var\(--chat-launcher-size\)\s*\+\s*var\(--space-3\)\)\s*;[^}]*bottom:\s*var\(--chat-offset-y\)\s*;/s.test(css) ||
      !/\.reading-list-panel\s*\{[^}]*bottom:\s*calc\(100%\s*\+\s*var\(--space-2\)\)\s*;/s.test(css)) {
    errors.push("Reading-list trigger must sit to the left of the chat launcher.");
  }
}

for (const file of files) {
  const document = new JSDOM(fs.readFileSync(file, "utf8")).window.document;
  const page = publicUrl(file);
  // Legacy redirect documents intentionally bypass the shared site layout.
  if (document.querySelector('meta[http-equiv="refresh"]')) continue;
  const isNote = Boolean(document.querySelector("main.note"));
  const buttons = document.querySelectorAll("[data-reading-list-save]");
  let manifest;
  try {
    manifest = JSON.parse(document.getElementById("reading-list-notes").textContent);
    if (!manifest.every((note) =>
      Object.keys(note).sort().join(",") === "category,slug,title,url")) {
      errors.push(`${page}: Manifest exposes unexpected fields.`);
    }
  } catch (error) {
    errors.push(`${page}: Manifest is not safe JSON.`);
  }
  if (isNote) {
    noteCount += 1;
    if (buttons.length !== 1) errors.push(`${page}: Expected one save control.`);
    const button = buttons[0];
    if (!button?.disabled || button?.type !== "button" || !button?.dataset.readingListSave ||
        !button?.getAttribute("aria-label")) {
      errors.push(`${page}: Save control is not safely and accessibly initialized.`);
    }
    if (!document.querySelector("[data-note-content]")) {
      errors.push(`${page}: Static note content is missing.`);
    }
    const expectedNote = Array.isArray(manifest)
      ? manifest.find((note) => note.url === page)
      : null;
    if (!expectedNote) {
      errors.push(`${page}: No corresponding backendNotes manifest entry was found.`);
    } else if (button?.dataset.readingListSave !== expectedNote.slug) {
      errors.push(
        `${page}: Save control identifier does not match backendNotes metadata.`
      );
    }
  } else if (buttons.length) {
    errors.push(`${page}: Save control emitted on a non-note page.`);
  }
  if (document.querySelectorAll("[data-reading-list-trigger]").length !== 1 ||
      document.querySelectorAll("[data-reading-list-panel]").length !== 1 ||
      document.querySelectorAll("[data-reading-list-status][aria-live='polite']").length !== 1 ||
      document.querySelectorAll("#reading-list-notes").length !== 1) {
    errors.push(`${page}: Site-wide reading-list markup is incomplete.`);
  }
  if (document.querySelector(".header-navigation-panel [data-reading-list-shell]")) {
    errors.push(`${page}: Reading-list trigger must not be inside the header navigation.`);
  }
}

if (!noteCount) errors.push("No generated technical note pages found.");
if (errors.length) {
  console.error("Reading-list verification failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Verified reading-list output across ${noteCount} note pages and ${files.length - noteCount} non-note pages.`);
