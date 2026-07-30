import fs from "node:fs";
import process from "node:process";
import { JSDOM } from "jsdom";

const errors = [];
const cv = JSON.parse(fs.readFileSync("src/_data/cv.json", "utf8"));
const outputPath = "_site/cv.html";

if (!fs.existsSync(outputPath)) {
  console.error(`CV verification failed:\n- Missing generated page: ${outputPath}`);
  process.exit(1);
}

const html = fs.readFileSync(outputPath, "utf8");
const document = new JSDOM(html).window.document;
const texts = (selector) =>
  [...document.querySelectorAll(selector)].map((node) => node.textContent.trim());
const expectOrder = (label, actual, expected) => {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    errors.push(`${label} do not match cv.json in count and source order.`);
  }
};

expectOrder("Experience companies", texts(".cv-role .cv-kicker"), cv.experience.map((role) => role.company));
expectOrder("Experience titles", texts(".cv-role h3"), cv.experience.map((role) => role.title));
expectOrder("Experience metadata", texts(".cv-role .cv-meta"), cv.experience.map((role) => role.meta));
expectOrder("Skill groups", texts(".cv-skill-panel .cv-kicker"), cv.skills.map((group) => group.group));
expectOrder("Education schools", texts(".cv-education-card .cv-kicker"), cv.education.map((entry) => entry.school));
expectOrder("Education degrees", texts(".cv-education-card h3"), cv.education.map((entry) => entry.degree));
expectOrder("Education metadata", texts(".cv-education-card .cv-meta"), cv.education.map((entry) => entry.meta));
expectOrder("Certification issuers", texts(".cv-credential-card .cv-kicker"), cv.certifications.map((group) => group.issuer));

const roles = [...document.querySelectorAll(".cv-role")];
roles.forEach((role, index) => {
  if (!cv.experience[index]) return;
  const roleTexts = (selector) =>
    [...role.querySelectorAll(selector)].map((node) => node.textContent.trim());
  expectOrder(`Experience ${index + 1} accomplishments`, roleTexts(".cv-list li"), cv.experience[index].bullets);
  expectOrder(`Experience ${index + 1} technologies`, roleTexts(".tag"), cv.experience[index].tech);
});

const skillPanels = [...document.querySelectorAll(".cv-skill-panel")];
skillPanels.forEach((panel, index) => {
  if (!cv.skills[index]) return;
  const panelTexts = (selector) =>
    [...panel.querySelectorAll(selector)].map((node) => node.textContent.trim());
  expectOrder(`Skill group ${index + 1} items`, panelTexts(".tag"), cv.skills[index].items);
});

const credentialCards = [...document.querySelectorAll(".cv-credential-card")];
credentialCards.forEach((card, index) => {
  if (!cv.certifications[index]) return;
  const cardTexts = (selector) =>
    [...card.querySelectorAll(selector)].map((node) => node.textContent.trim());
  expectOrder(`Certification issuer ${index + 1} items`, cardTexts("li"), cv.certifications[index].items);
});

if (document.querySelectorAll("h1").length !== 1) errors.push("Expected exactly one h1.");
for (const heading of ["Experience", "Skills", "Education", "Certifications"]) {
  if (!texts(".cv-group > h2, .cv-group .section-head > h2").includes(heading)) {
    errors.push(`Missing section heading "${heading}".`);
  }
}
if (document.querySelectorAll(".cv-role").length !== cv.experience.length) errors.push("Missing experience rows.");
if (document.querySelectorAll(".cv-skill-panel").length !== cv.skills.length) errors.push("Missing grouped skill rows.");
if (document.querySelectorAll(".cv-credential-card").length !== cv.certifications.length) errors.push("Missing credential rows.");

const skillsLink = document.querySelector('#skills a[href="/skills.html"]');
if (!skillsLink) errors.push("Missing Skills in Practice link.");
const credly = document.querySelector('a[href="https://www.credly.com/users/omar-massfih"]');
if (!credly || credly.getAttribute("target") !== "_blank" || credly.getAttribute("rel") !== "me noopener") {
  errors.push("Credly link is missing or has incorrect external-link attributes.");
}
const printButton = document.querySelector('button[type="button"][onclick="window.print()"]');
if (!printButton) errors.push("Print control is not a button wired to window.print().");

if (document.querySelector("[data-cv-app], #cv-app")) errors.push("CV application root was emitted.");
if (html.match(/\bfetch\s*\(/)) errors.push("CV output contains a data fetch.");
for (const script of document.querySelectorAll("script[src]")) {
  if (/cv/i.test(script.getAttribute("src"))) errors.push("CV-specific script dependency was emitted.");
}

if (errors.length) {
  console.error("CV verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Verified generated CV data coverage, order, links, headings, and static print behavior.");
