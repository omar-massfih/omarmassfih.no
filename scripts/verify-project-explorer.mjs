import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";
import buildProjectExplorer from "../lib/projectExplorer.js";

const errors = [];
const projects = JSON.parse(fs.readFileSync("src/_data/projects.json", "utf8"));
const expected = buildProjectExplorer(projects);
const outputPath = path.resolve("_site/projects.html");

if (!fs.existsSync(outputPath)) {
  console.error("Project explorer verification failed:\n- Missing _site/projects.html.");
  process.exit(1);
}

const html = fs.readFileSync(outputPath, "utf8");
const document = new JSDOM(html).window.document;
const cards = [...document.querySelectorAll(".project-box")];

if (cards.length !== expected.projects.length) {
  errors.push(`Expected ${expected.projects.length} published cards; found ${cards.length}.`);
}

for (const [index, project] of expected.projects.entries()) {
  const card = cards[index];
  if (!card) continue;
  const name = card.querySelector("h2")?.textContent.trim().replace(/\s+/g, " ");
  if (!name?.startsWith(project.name)) errors.push(`Card ${index + 1} does not render "${project.name}".`);
  if (card.querySelector("a")?.getAttribute("href") !== project.url) {
    errors.push(`Project "${project.name}" does not use its canonical URL.`);
  }
  if (card.dataset.source !== project.source) {
    errors.push(`Project "${project.name}" has incorrect source metadata.`);
  }
  let technologies;
  try {
    technologies = JSON.parse(card.dataset.technologies);
  } catch {
    errors.push(`Project "${project.name}" has invalid technology JSON.`);
  }
  if (JSON.stringify(technologies) !== JSON.stringify(project.tags)) {
    errors.push(`Project "${project.name}" has incorrect technology metadata.`);
  }
  if (card.hasAttribute("hidden")) errors.push(`Project "${project.name}" is initially hidden.`);
}

for (const draft of projects.filter(({ draft }) => draft)) {
  if (cards.some((card) => card.textContent.includes(draft.name))) {
    errors.push(`Draft project "${draft.name}" was rendered.`);
  }
}

const optionValues = (name) =>
  [...document.querySelectorAll(`select[name="${name}"] option`)]
    .map((option) => option.value)
    .filter(Boolean);
if (JSON.stringify(optionValues("technology")) !== JSON.stringify(expected.technologies)) {
  errors.push("Technology options do not match published project metadata.");
}
if (JSON.stringify(optionValues("source")) !== JSON.stringify(expected.sources)) {
  errors.push("Source options do not match published project metadata.");
}

const form = document.querySelector("form.project-filter[hidden]");
if (!form) errors.push("Missing initially hidden project filter form.");
for (const name of ["technology", "source"]) {
  const select = document.querySelector(`select[name="${name}"]`);
  if (!select?.id || !document.querySelector(`label[for="${select.id}"]`)) {
    errors.push(`The ${name} select is not explicitly labeled.`);
  }
}
const count = document.querySelector("[data-project-count]");
if (count?.getAttribute("aria-live") !== "polite" || count?.getAttribute("aria-atomic") !== "true") {
  errors.push("Result count is missing its accessible live-region attributes.");
}
if (!document.querySelector("[data-project-clear]")) errors.push("Missing clear-filters control.");
if (!document.querySelector("[data-project-empty][hidden]")) {
  errors.push("Missing initially hidden no-results state.");
}

const script = document.querySelector('script[src^="/projects-filter.js?v="]');
if (!script?.hasAttribute("defer")) errors.push("Missing deferred hashed project-filter script.");
if (!fs.existsSync(path.resolve("_site/projects-filter.js"))) {
  errors.push("Missing built projects-filter.js asset.");
}

if (errors.length) {
  console.error("Project explorer verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Verified published project cards, facets, accessibility, no-JS markup, and filter asset.");
