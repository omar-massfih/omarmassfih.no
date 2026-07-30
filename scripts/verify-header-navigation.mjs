import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";

const errors = [];
const pages = [
  ["index.html", "Omar Massfih"],
  ["projects.html", "Projects"],
  ["projects/omarmassfih-no.html", "Projects"],
  ["notes.html", "Notes"],
  ["notes/rag/retrieval.html", "Notes"],
  ["notes/categories/kubernetes-k3s.html", "Notes"],
  ["cv.html", "CV"],
  ["about.html", "About"],
];

if (!fs.existsSync(path.resolve("_site/header-navigation.js"))) {
  errors.push("Missing built header-navigation.js asset.");
}

for (const [page, expectedCurrent] of pages) {
  const output = path.resolve("_site", page);
  if (!fs.existsSync(output)) {
    errors.push(`${page}: generated page is missing.`);
    continue;
  }

  const document = new JSDOM(fs.readFileSync(output, "utf8")).window.document;
  const nav = document.querySelector('nav[aria-label="Primary navigation"]');
  const toggle = document.querySelector(
    '#header-menu-toggle[hidden][aria-expanded="false"][aria-controls="header-navigation-panel"]'
  );
  const panel = document.querySelector("#header-navigation-panel:not([hidden])");
  const script = document.querySelector(
    'script[src^="/header-navigation.js?v="][defer]'
  );
  const current = [...document.querySelectorAll('[aria-current="page"]')];

  if (!nav) errors.push(`${page}: missing labeled primary navigation.`);
  if (!toggle) errors.push(`${page}: missing collapsed hidden menu toggle.`);
  if (!panel) errors.push(`${page}: navigation fallback is not visible.`);
  if (!script) errors.push(`${page}: missing deferred hashed navigation script.`);
  if (current.length !== 1 || current[0]?.textContent.trim() !== expectedCurrent) {
    errors.push(`${page}: expected only ${expectedCurrent} to be current.`);
  }
  for (const label of ["Projects", "Notes", "CV", "About"]) {
    if (![...panel?.querySelectorAll("a") || []].some((link) => link.textContent.trim() === label)) {
      errors.push(`${page}: missing ${label} fallback link.`);
    }
  }
}

if (errors.length) {
  console.error("Header navigation verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Verified responsive navigation markup and current state across ${pages.length} pages.`);
