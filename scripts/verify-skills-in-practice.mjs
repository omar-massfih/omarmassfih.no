import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";

const siteDir = path.resolve("_site");
const errors = [];
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.resolve(relativePath), "utf8"));
const cv = readJson("src/_data/cv.json");
const projects = readJson("src/_data/projects.json");

function readOutput(relativePath, label) {
  const filePath = path.join(siteDir, relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing ${label}: ${path.relative(process.cwd(), filePath)}`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

const skillsHtml = readOutput("skills.html", "Skills in practice page");
const cvHtml = readOutput("cv.html", "CV page");
const projectsHtml = readOutput("projects.html", "Projects page");
const sitemap = readOutput("sitemap.xml", "sitemap");
const notesManifestJson = readOutput(
  "skills-evidence-manifest.json",
  "skills evidence note manifest"
);
const document = new JSDOM(skillsHtml).window.document;
const projectIndex = new Map(projects.map((project) => [project.name, project]));
let notesManifest = [];
try {
  notesManifest = JSON.parse(notesManifestJson);
} catch (error) {
  errors.push(`Skills evidence note manifest is invalid JSON: ${error.message}`);
}
const noteIndex = new Map();
for (const note of notesManifest) {
  if (noteIndex.has(note.slug)) {
    errors.push(`Skills evidence note manifest has duplicate slug "${note.slug}".`);
  }
  noteIndex.set(note.slug, note);
}

function generatedTarget(href) {
  const pathname = new URL(href, "https://omarmassfih.no").pathname;
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "");
  return path.join(siteDir, pathname.endsWith("/") ? relativePath + "index.html" : relativePath);
}

for (const [label, html] of [["CV", cvHtml], ["Projects", projectsHtml]]) {
  const linked = [...new JSDOM(html).window.document.querySelectorAll("a")]
    .some((link) => link.getAttribute("href") === "/skills.html");
  if (!linked) errors.push(`${label} page does not link to /skills.html.`);
}

const expectedSkills = cv.skills.flatMap((group) => group.items);
const renderedSkills = [...document.querySelectorAll("[data-skill]")];
for (const skill of expectedSkills) {
  const count = renderedSkills.filter((node) => node.dataset.skill === skill).length;
  if (count !== 1) errors.push(`Expected competency "${skill}" exactly once; found ${count}.`);
}
for (const node of renderedSkills) {
  if (!expectedSkills.includes(node.dataset.skill)) {
    errors.push(`Rendered unknown competency "${node.dataset.skill}".`);
  }
}

for (const evidence of document.querySelectorAll("[data-evidence-type][data-evidence-id]")) {
  const type = evidence.dataset.evidenceType;
  const id = evidence.dataset.evidenceId;
  const link = evidence.querySelector("a[href]");
  if (!link) {
    errors.push(`${type} evidence "${id}" has no link.`);
    continue;
  }

  if (type === "project") {
    const project = projectIndex.get(id);
    if (!project) errors.push(`Rendered project "${id}" is absent from projects.json.`);
    else {
      if (project.draft) errors.push(`Rendered draft project "${id}".`);
      if (link.getAttribute("href") !== project.url) {
        errors.push(`Project "${id}" does not use its canonical URL.`);
      }
    }
  } else if (type === "note") {
    const href = link.getAttribute("href");
    const note = noteIndex.get(id);
    if (!note) {
      errors.push(`Rendered note "${id}" is absent from the build note manifest.`);
    } else {
      if (note.published === false) errors.push(`Rendered unpublished note "${id}".`);
      if (href !== note.url) errors.push(`Note "${id}" does not use its canonical URL.`);
    }
    if (!href?.startsWith("/notes/")) {
      errors.push(`Note "${id}" has invalid URL "${href || ""}".`);
    }
  } else {
    errors.push(`Evidence "${id}" has unknown type "${type}".`);
  }

  const href = link.getAttribute("href");
  if (href?.startsWith("/")) {
    const target = generatedTarget(href);
    let isFile = false;
    try {
      isFile = fs.statSync(target).isFile();
    } catch {
      // Report the common missing-target error below.
    }
    if (!isFile) errors.push(`Internal evidence URL has no generated file target: ${href}`);
  }
}

for (const project of projects.filter((project) => project.draft)) {
  if (document.querySelector(`[data-evidence-type="project"][data-evidence-id="${project.name}"]`)) {
    errors.push(`Draft project "${project.name}" appears on the page.`);
  }
}

const headings = document.querySelectorAll("h1");
if (headings.length !== 1) errors.push(`Expected one top-level heading; found ${headings.length}.`);
if (document.querySelectorAll(".skills-group > h2").length !== cv.skills.length) {
  errors.push("Skill group headings do not match the CV groups.");
}
if (!sitemap.includes("<loc>https://omarmassfih.no/skills.html</loc>")) {
  errors.push("Sitemap does not contain /skills.html.");
}

if (errors.length) {
  console.error("Skills-in-practice verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Verified skills coverage, evidence publication, links, headings, and sitemap entry.");
