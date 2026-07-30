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

function pageUrl(filePath) {
  return `/${path.relative(siteDir, filePath).split(path.sep).join("/")}`;
}

const noteFiles = walkHtmlFiles(notesDir);
if (!noteFiles.length) errors.push("No generated note HTML files found under _site/notes.");

for (const file of noteFiles) {
  const document = new JSDOM(fs.readFileSync(file, "utf8")).window.document;
  const currentUrl = pageUrl(file);
  const mainSection = document.querySelector("main.note > section:first-child");
  if (!mainSection) {
    errors.push(`${currentUrl}: Expected note container main.note > section:first-child is missing.`);
    continue;
  }

  const headings = [...mainSection.querySelectorAll("h2:not(#note-toc-heading), h3")];
  const ids = headings.map((heading) => heading.id);

  if (ids.some((id) => !id)) errors.push(`${currentUrl}: A note-body heading has no ID.`);
  if (new Set(ids).size !== ids.length) errors.push(`${currentUrl}: Note-body heading IDs are not unique.`);

  for (const heading of headings) {
    const anchors = [...heading.children].filter((child) =>
      child.matches("a.heading-anchor")
    );
    if (anchors.length !== 1) {
      errors.push(`${currentUrl}: #${heading.id} must have exactly one permalink.`);
      continue;
    }

    const target = decodeURIComponent(anchors[0].hash.slice(1));
    if (document.getElementById(target) !== heading) {
      errors.push(`${currentUrl}: Permalink for #${heading.id} does not resolve to its heading.`);
    }
  }

  const tocNavs = [...document.querySelectorAll("nav.note-toc")];
  if (headings.length && tocNavs.length !== 1) {
    errors.push(`${currentUrl}: A note with headings must have exactly one TOC.`);
    continue;
  }
  if (!headings.length && tocNavs.length) {
    errors.push(`${currentUrl}: A note without headings must not have a TOC.`);
    continue;
  }
  if (!headings.length) continue;

  const toc = tocNavs[0];
  if (toc.getAttribute("aria-labelledby") !== "note-toc-heading") {
    errors.push(`${currentUrl}: TOC is not labeled by note-toc-heading.`);
  }

  const links = [...toc.querySelectorAll("ol a")];
  const tocIds = links.map((link) => decodeURIComponent(link.hash.slice(1)));
  const tocText = links.map((link) => link.textContent.trim().replace(/\s+/g, " "));
  const headingText = headings.map((heading) => {
    const clone = heading.cloneNode(true);
    clone.querySelectorAll(".heading-anchor").forEach((anchor) => anchor.remove());
    return clone.textContent.trim().replace(/\s+/g, " ");
  });

  if (JSON.stringify(tocIds) !== JSON.stringify(ids)) {
    errors.push(`${currentUrl}: TOC targets do not match heading order.`);
  }
  for (const [index, target] of tocIds.entries()) {
    if (document.getElementById(target) !== headings[index]) {
      errors.push(`${currentUrl}: TOC link to #${target} does not resolve to its heading.`);
    }
  }
  if (JSON.stringify(tocText) !== JSON.stringify(headingText)) {
    errors.push(`${currentUrl}: TOC text does not match heading text.`);
  }
}

if (errors.length) {
  console.error("Note heading verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Verified heading permalinks and TOCs in ${noteFiles.length} generated note pages.`);
