import fs from "node:fs";
import process from "node:process";
import { JSDOM } from "jsdom";

const errors = [];
const outputPath = "_site/about.html";
const internalPaths = ["/projects.html", "/notes.html", "/cv.html"];
const contacts = [
  "mailto:me@omarmassfih.no",
  "https://www.linkedin.com/in/omarmassfih",
  "https://github.com/omar-massfih",
];

if (!fs.existsSync(outputPath)) {
  console.error(`About verification failed:\n- Missing generated page: ${outputPath}`);
  process.exit(1);
}

const html = fs.readFileSync(outputPath, "utf8");
const document = new JSDOM(html).window.document;
const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

expect(document.querySelectorAll("h1").length === 1, "Expected exactly one h1.");
expect(document.querySelector("main.about-main > article.about-profile"), "Missing About profile container.");
expect(
  document.querySelector(".about-hero > .about-portrait + .about-hero-content"),
  "Hero must keep portrait and content as ordered siblings."
);

const portrait = document.querySelector('.about-portrait img[src="/bilder/1690240717543.jpeg"]');
expect(portrait, "Missing expected portrait.");
if (portrait) {
  expect(portrait.getAttribute("alt")?.trim(), "Portrait needs non-empty alternative text.");
  expect(portrait.getAttribute("width") === "800" && portrait.getAttribute("height") === "800", "Portrait dimensions changed.");
}

expect(document.querySelectorAll(".about-career-entry").length === 3, "Expected three career entries.");
expect(document.querySelectorAll(".about-highlight-card").length === 4, "Expected four platform highlights.");
expect(document.querySelector("ol.about-career-list"), "Missing ordered career list hook.");
expect(document.querySelector("div.about-highlight-grid"), "Missing platform highlight grid hook.");
expect(document.querySelector("nav.about-explore-grid"), "Missing exploration grid hook.");

const careerText = document.querySelector(".about-career-list")?.textContent || "";
for (const detail of ["BAMA", "IBM", "University of Oslo"]) {
  expect(new RegExp(detail, "i").test(careerText), `Missing career detail: ${detail}.`);
}
const platformText = document.querySelector(".about-highlight-grid")?.textContent || "";
for (const detail of ["Python", "dlt", "dbt", "Azure", "Snowflake", "LangGraph", "LangChain", "Terraform", "CI/CD", "Kubernetes", "OpenShift", "10 Azure", "6 Red Hat"]) {
  expect(platformText.includes(detail), `Missing platform detail: ${detail}.`);
}

const ids = [...document.querySelectorAll("[id]")].map((node) => node.id);
expect(new Set(ids).size === ids.length, "Generated page contains duplicate IDs.");
for (const section of document.querySelectorAll("section[aria-labelledby]")) {
  const headingId = section.getAttribute("aria-labelledby");
  expect(document.getElementById(headingId), `aria-labelledby references missing ID: ${headingId}.`);
}
for (const nav of document.querySelectorAll("nav")) {
  expect(nav.getAttribute("aria-label") || nav.getAttribute("aria-labelledby"), "Navigation landmark lacks an accessible label.");
}

for (const href of internalPaths) {
  expect(document.querySelector(`.about-primary-paths a[href="${href}"]`), `Missing primary pathway: ${href}.`);
  expect(document.querySelector(`.about-explore-grid a[href="${href}"]`), `Missing Explore pathway: ${href}.`);
  const destination = `_site${href}`;
  expect(fs.existsSync(destination), `Internal destination does not exist: ${destination}.`);
}
for (const href of contacts) {
  const link = document.querySelector(`.about-contact-list a[href="${href}"]`);
  expect(link, `Missing contact destination: ${href}.`);
  expect(link?.textContent.trim(), `Contact link lacks an accessible name: ${href}.`);
}

expect(!document.querySelector("[data-about-app], #about-app"), "About application root was emitted.");
expect(!/\bfetch\s*\(/.test(html), "About output contains a fetch call.");
for (const script of document.querySelectorAll("script[src]")) {
  expect(!/about/i.test(script.getAttribute("src")), "About-specific script dependency was emitted.");
}

if (errors.length) {
  console.error("About verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Verified generated About semantics, biography coverage, responsive hooks, links, and static output.");
