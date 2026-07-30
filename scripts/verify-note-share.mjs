import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";

const siteDir = path.resolve("_site");
const errors = [];

function walkHtmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkHtmlFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
  });
}

const htmlFiles = walkHtmlFiles(siteDir);
const noteFiles = [];
if (!fs.existsSync(path.join(siteDir, "note-share.js"))) {
  errors.push("_site/note-share.js was not emitted.");
}

for (const file of htmlFiles) {
  const document = new JSDOM(fs.readFileSync(file, "utf8")).window.document;
  const page = `/${path.relative(siteDir, file).split(path.sep).join("/")}`;
  const isNote = Boolean(document.querySelector("main.note"));
  const panels = [...document.querySelectorAll("[data-note-share]")];
  const scripts = [...document.querySelectorAll('script[src^="/note-share.js?v="]')];

  if (!isNote) {
    if (panels.length) errors.push(`${page}: Share panel emitted on a non-note page.`);
    if (scripts.length) errors.push(`${page}: Note share script emitted on a non-note page.`);
    continue;
  }

  noteFiles.push(file);
  if (panels.length !== 1) {
    errors.push(`${page}: Expected one share panel, found ${panels.length}.`);
    continue;
  }
  if (scripts.length !== 1) {
    errors.push(`${page}: Expected one cache-busted note-share.js reference, found ${scripts.length}.`);
  }

  const canonicalLinks = [...document.querySelectorAll('link[rel="canonical"]')];
  if (canonicalLinks.length !== 1) {
    errors.push(`${page}: Expected one canonical link, found ${canonicalLinks.length}.`);
    continue;
  }
  const canonical = canonicalLinks[0].href;
  if (!/^https?:\/\//.test(canonical)) {
    errors.push(`${page}: Canonical URL is not absolute.`);
  }

  const panel = panels[0];
  const title = panel.dataset.shareTitle;
  const email = panel.querySelector('a[href^="mailto:"]');
  const nativeButton = panel.querySelector('[data-note-share-native][type="button"]');
  const copyButton = panel.querySelector('[data-note-share-copy][type="button"]');
  const status = panel.querySelector('[data-note-share-status][role="status"][aria-live="polite"]');

  if (document.querySelector("[data-note-content] [data-note-share]")) {
    errors.push(`${page}: Share panel appears inside the authored note boundary.`);
  }
  if (!email) {
    errors.push(`${page}: Missing static email fallback.`);
  } else {
    const mailto = new URL(email.href);
    if (!mailto.searchParams.get("subject")?.includes(title)) {
      errors.push(`${page}: Email subject does not contain the note title.`);
    }
    const body = mailto.searchParams.get("body") || "";
    if (!body.includes(title) || !body.includes(canonical)) {
      errors.push(`${page}: Email body does not contain the note title and canonical URL.`);
    }
  }
  if (!nativeButton?.hidden || !copyButton?.hidden) {
    errors.push(`${page}: Enhancement-only buttons are not initially hidden.`);
  }
  if (!status?.id) {
    errors.push(`${page}: Missing polite share status.`);
  } else if (
    nativeButton?.getAttribute("aria-describedby") !== status.id ||
    copyButton?.getAttribute("aria-describedby") !== status.id
  ) {
    errors.push(`${page}: Share controls are not associated with the status.`);
  }
}

if (!noteFiles.length) errors.push("No generated technical note pages found.");

if (errors.length) {
  console.error("Note share verification failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Verified share output across ${noteFiles.length} note pages and ${htmlFiles.length - noteFiles.length} non-note pages.`);
