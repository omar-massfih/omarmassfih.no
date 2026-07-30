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
const cards = [...document.querySelectorAll("[data-project-results] > .project-box")];
const results = document.querySelector("[data-project-results].project-results.card-grid");

if (!results) errors.push("Missing shared project results grid.");
if (cards.length !== expected.projects.length) {
  errors.push(`Expected ${expected.projects.length} published cards; found ${cards.length}.`);
}

const cardForProject = (project) =>
  cards.filter((card) => {
    const heading = card.querySelector("h2")?.textContent.trim().replace(/\s+/g, " ");
    return heading === project.name;
  });

for (const project of expected.projects) {
  const matches = cardForProject(project);
  if (matches.length !== 1) {
    errors.push(`Expected project "${project.name}" exactly once; found ${matches.length}.`);
    continue;
  }
  const card = matches[0];
  if (![...card.querySelectorAll("a")].some((link) => link.getAttribute("href") === project.url)) {
    errors.push(`Project "${project.name}" does not use its canonical URL.`);
  }
  if (card.dataset.source !== project.source) {
    errors.push(`Project "${project.name}" has incorrect source metadata.`);
  }
  const normalizedText = card.textContent.replace(/\s+/g, " ");
  for (const [field, value] of [
    ["source", project.source],
    ["summary", project.summary],
    ["description", project.description],
  ]) {
    if (!normalizedText.includes(value)) {
      errors.push(`Project "${project.name}" is missing its ${field}.`);
    }
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
  const renderedTags = [...card.querySelectorAll(".tag")].map((tag) => tag.textContent.trim());
  if (JSON.stringify(renderedTags) !== JSON.stringify(project.tags)) {
    errors.push(`Project "${project.name}" does not render its complete technology list.`);
  }
  const tagList = card.querySelector(".tag-list");
  if (tagList?.getAttribute("aria-label") !== "Technologies") {
    errors.push(`Project "${project.name}" is missing a semantic technology label.`);
  }
  if (card.hasAttribute("hidden")) errors.push(`Project "${project.name}" is initially hidden.`);
}

const renderedNames = cards.map(
  (card) => card.querySelector("h2")?.textContent.trim().replace(/\s+/g, " ")
);
if (JSON.stringify(renderedNames) !==
    JSON.stringify(expected.projects.map(({ name }) => name))) {
  errors.push("Projects do not preserve source order.");
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

const cssPath = path.resolve("_site/style.css");
if (!fs.existsSync(cssPath)) {
  errors.push("Missing built stylesheet.");
} else {
  const css = fs.readFileSync(cssPath, "utf8");
  for (const hook of [".project-box", ".card-grid"]) {
    if (!css.includes(hook)) errors.push(`Built stylesheet is missing project hook "${hook}".`);
  }
}

if (errors.length) {
  console.error("Project explorer verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  "Verified simplified project output, accessibility, no-JS markup, facets, and filter asset."
);
