import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";

const siteDir = path.resolve("_site");
const caseStudyPath = path.join(siteDir, "projects", "omarmassfih-no.html");
const projectsPath = path.join(siteDir, "projects.html");
const sitemapPath = path.join(siteDir, "sitemap.xml");
const errors = [];

const readOutput = (filePath, label) => {
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing ${label}: ${path.relative(process.cwd(), filePath)}`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
};

const caseStudy = readOutput(caseStudyPath, "generated case-study page");
const projects = readOutput(projectsPath, "generated Projects page");
const sitemap = readOutput(sitemapPath, "generated sitemap");

const requireMatch = (html, pattern, message) => {
  if (!pattern.test(html)) errors.push(message);
};

requireMatch(
  projects,
  /href="\/projects\/omarmassfih-no\.html"/,
  "Projects page does not link to /projects/omarmassfih-no.html."
);

const caseStudyDocument = new JSDOM(caseStudy).window.document;
const caseStudyHeading = caseStudyDocument.querySelector("#case-study-title");
if (caseStudyHeading?.tagName !== "H1") {
  errors.push("Case study is missing its marked top-level heading.");
}

const flows = [
  ["Authoring flow", "publishing", ["backend-notes", "seed-embed-workflow", "turso"]],
  ["Static-delivery flow", "static-delivery", ["turso-notes", "notes-api", "eleventy-loader", "github-pages"]],
  ["Redeployment flow", "redeployment", ["backend-action", "repository-dispatch", "frontend-action"]],
  ["Hybrid-RAG flow", "hybrid-rag", [
    "browser-chat",
    "chat-api",
    "question-embedding",
    "hybrid-retrieval",
    "rank-fusion",
    "tag-neighbors",
    "ai-gateway",
    "sse-response",
  ]],
];

for (const [label, area, expectedComponents] of flows) {
  const container = caseStudyDocument.querySelector(`[data-architecture-area="${area}"]`);
  if (!container) {
    errors.push(`Architecture is missing the ${area} area.`);
    continue;
  }

  const actualComponents = [...container.querySelectorAll("[data-component]")]
    .map((node) => node.getAttribute("data-component"));
  if (
    actualComponents.length !== expectedComponents.length ||
    actualComponents.some((component, index) => component !== expectedComponents[index])
  ) {
    errors.push(
      `${label}: expected components in order ${expectedComponents.join(", ")}; found ${actualComponents.join(", ") || "none"}.`
    );
  }
}

for (const label of [
  'aria-label="Authoring and publishing flow"',
  'aria-label="Static delivery flow"',
  'aria-label="Redeployment control flow"',
  'aria-label="Streamed hybrid-RAG query flow"',
]) {
  requireMatch(caseStudy, new RegExp(label), `Architecture is missing semantic label ${label}.`);
}

const sectionLinks = {
  "build-time-loading": [
    "https://github.com/omar-massfih/omarmassfih.no/blob/master/src/_data/backendNotes.js",
    "https://github.com/omar-massfih/omarmassfih.no/blob/master/lib/notesLoader.js",
    "https://github.com/omar-massfih/omarmassfih.no/blob/master/eleventy.config.js",
    "https://github.com/omar-massfih/omarmassfih.no/blob/master/scripts/verify-case-study.mjs",
  ],
  publishing: [
    "https://github.com/omar-massfih/omarmassfih.no-backend/blob/main/app/notes.py",
    "https://github.com/omar-massfih/omarmassfih.no-backend/blob/main/app/database.py",
    "https://github.com/omar-massfih/omarmassfih.no-backend/blob/main/app/main.py",
    "https://github.com/omar-massfih/omarmassfih.no-backend/blob/main/scripts/seed_notes.py",
    "https://github.com/omar-massfih/omarmassfih.no-backend/blob/main/scripts/embed_notes.py",
    "https://github.com/omar-massfih/omarmassfih.no-backend/blob/main/tests/test_notes.py",
  ],
  redeployment: [
    "https://github.com/omar-massfih/omarmassfih.no-backend/blob/main/.github/workflows/seed-notes.yml",
    "https://github.com/omar-massfih/omarmassfih.no/blob/master/.github/workflows/static.yml",
  ],
  "hybrid-rag": [
    "https://github.com/omar-massfih/omarmassfih.no/blob/master/src/chat.js",
    "https://github.com/omar-massfih/omarmassfih.no-backend/blob/main/app/chat.py",
    "https://github.com/omar-massfih/omarmassfih.no-backend/blob/main/app/rag.py",
    "https://github.com/omar-massfih/omarmassfih.no-backend/blob/main/app/gateway.py",
    "https://github.com/omar-massfih/omarmassfih.no-backend/blob/main/tests/test_chat.py",
    "https://github.com/omar-massfih/omarmassfih.no-backend/blob/main/tests/test_rag.py",
  ],
};

for (const [area, requiredLinks] of Object.entries(sectionLinks)) {
  const section = caseStudyDocument.querySelector(`[data-case-study-area="${area}"]`);
  if (!section) {
    errors.push(`Case study is missing the ${area} detail section.`);
    continue;
  }

  for (const href of requiredLinks) {
    if (!section.querySelector(`a[href="${href}"]`)) {
      errors.push(`The ${area} section is missing required source or test link: ${href}`);
    }
  }
}

const ids = new Set([...caseStudy.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
for (const [, fragment] of caseStudy.matchAll(/href="#([^"]+)"/g)) {
  if (!ids.has(fragment)) errors.push(`Internal case-study link points to missing id: #${fragment}`);
}

requireMatch(
  sitemap,
  /<loc>https:\/\/omarmassfih\.no\/projects\/omarmassfih-no\.html<\/loc>/,
  "Sitemap does not contain the case-study URL."
);

if (errors.length) {
  console.error("Case-study verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Verified case-study structure, architecture, links, and sitemap entry.");
