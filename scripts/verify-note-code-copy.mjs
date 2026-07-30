import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";

const siteDir = path.resolve("_site");
const notesDir = path.join(siteDir, "notes");
const expectedCodeBlockCount = 13;
const errors = [];

function walkHtmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkHtmlFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
  });
}

const noteFiles = walkHtmlFiles(notesDir);
let codeBlockCount = 0;
let pageWithoutCode = false;
let representativeSourceFound = false;

if (!noteFiles.length) errors.push("No generated note pages found under _site/notes.");
if (!fs.existsSync(path.join(siteDir, "note-code-copy.js"))) {
  errors.push("_site/note-code-copy.js was not emitted.");
}

for (const file of noteFiles) {
  const document = new JSDOM(fs.readFileSync(file, "utf8")).window.document;
  const page = `/${path.relative(siteDir, file).split(path.sep).join("/")}`;
  const scripts = [...document.querySelectorAll('script[src^="/note-code-copy.js?v="]')];
  if (scripts.length !== 1) {
    errors.push(`${page}: Expected one cache-busted note-code-copy.js reference, found ${scripts.length}.`);
  }

  const codeBlocks = [];
  const preBlocks = [...document.querySelectorAll("main.note pre")];

  for (const pre of preBlocks) {
    const directCodeChildren = [...pre.children].filter(
      (child) => child.tagName === "CODE"
    );
    const nestedCode = [...pre.querySelectorAll("code")];

    if (directCodeChildren.length !== 1 || nestedCode.length !== 1) {
      errors.push(
        `${page}: Expected each note pre to contain exactly one direct code child.`
      );
      continue;
    }

    codeBlocks.push(directCodeChildren[0]);
  }

  codeBlockCount += codeBlocks.length;
  pageWithoutCode ||= preBlocks.length === 0;

  if (document.querySelector(".code-block, .code-copy-button, .code-copy-status")) {
    errors.push(`${page}: Copy controls must not be present in static output.`);
  }

  for (const code of codeBlocks) {
    if (code.querySelector(".code-block, .code-copy-button, .code-copy-status, button, [role='status']")) {
      errors.push(`${page}: Copy controls must not be nested inside code content.`);
    }
    if (code.textContent === "oc apply -f clusterissuer.yaml") {
      representativeSourceFound = true;
    }
  }
}

if (codeBlockCount !== expectedCodeBlockCount) {
  errors.push(
    `Expected ${expectedCodeBlockCount} generated <pre><code> fixtures, found ${codeBlockCount}.`
  );
}
if (!pageWithoutCode) errors.push("No generated note without a code block was found.");
if (!representativeSourceFound) {
  errors.push("Representative command text was not preserved exactly.");
}

if (errors.length) {
  console.error("Note code-copy verification failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Verified ${codeBlockCount} preserved code blocks and script delivery across ${noteFiles.length} note pages.`
);
