import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import nunjucks from "nunjucks";
import { JSDOM } from "jsdom";

const source = fs.readFileSync("src/about.html", "utf8").replace(/^---[\s\S]*?---\s*/, "");
const environment = new nunjucks.Environment(null, { autoescape: true });
const render = () => new JSDOM(environment.renderString(source)).window.document;

const internalPaths = ["/projects.html", "/notes.html", "/cv.html"];
const contacts = [
  "mailto:me@omarmassfih.no",
  "https://www.linkedin.com/in/omarmassfih",
  "https://github.com/omar-massfih",
];

test("renders a semantic portrait-led profile in meaningful source order", () => {
  const document = render();
  assert.equal(document.querySelectorAll("h1").length, 1);
  assert.ok(document.querySelector("main.about-main > article.about-profile"));

  const hero = document.querySelector(".about-hero");
  assert.ok(hero);
  assert.equal(hero.children.length, 2);
  assert.ok(hero.children[0].matches("figure.about-portrait"));
  assert.ok(hero.children[1].matches(".about-hero-content"));

  const portrait = hero.querySelector("img");
  assert.equal(portrait.getAttribute("src"), "/bilder/1690240717543.jpeg");
  assert.ok(portrait.getAttribute("alt").trim());
  assert.equal(portrait.getAttribute("width"), "800");
  assert.equal(portrait.getAttribute("height"), "800");

  const sections = [...document.querySelectorAll(".about-profile > section")];
  assert.deepEqual(
    sections.map((section) => section.getAttribute("aria-labelledby")),
    ["career-heading", "platform-heading", "explore-heading", "contact-heading"]
  );
  for (const section of sections) {
    assert.ok(document.getElementById(section.getAttribute("aria-labelledby")));
  }
});

test("retains career, platform engineering, and certification biography details", () => {
  const document = render();
  const careerText = document.querySelector(".about-career-list").textContent;
  for (const detail of ["BAMA", "IBM", "University of Oslo"]) assert.match(careerText, new RegExp(detail, "i"));
  assert.equal(document.querySelectorAll(".about-career-entry").length, 3);

  const platformText = document.querySelector(".about-highlight-grid").textContent;
  for (const detail of [
    "Python", "dlt", "dbt", "Azure", "Snowflake", "LangGraph", "LangChain",
    "Terraform", "CI/CD", "Kubernetes", "OpenShift", "10 Azure", "6 Red Hat",
  ]) {
    assert.ok(platformText.includes(detail), `Missing platform detail: ${detail}`);
  }
  assert.equal(document.querySelectorAll(".about-highlight-card").length, 4);
});

test("provides exact internal pathways and existing contact destinations", () => {
  const document = render();
  for (const href of internalPaths) {
    assert.ok(document.querySelector(`.about-primary-paths a[href="${href}"]`));
    assert.ok(document.querySelector(`.about-explore-grid a[href="${href}"]`));
  }
  for (const href of contacts) {
    const link = document.querySelector(`.about-contact-list a[href="${href}"]`);
    assert.ok(link, `Missing contact: ${href}`);
    assert.ok(link.textContent.trim(), `Contact lacks accessible text: ${href}`);
  }
  assert.ok(document.querySelector('nav[aria-label="Primary profile links"]'));
  assert.ok(document.querySelector('nav[aria-label="Explore Omar’s work"]'));
});

test("exposes responsive layout hooks without adding dynamic About behavior", () => {
  const document = render();
  assert.ok(document.querySelector(".about-hero > .about-portrait + .about-hero-content"));
  assert.ok(document.querySelector("ol.about-career-list"));
  assert.ok(document.querySelector("div.about-highlight-grid"));
  assert.ok(document.querySelector("nav.about-explore-grid"));
  assert.equal(document.querySelector("[data-about-app], #about-app"), null);
  assert.equal(document.querySelector("script"), null);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});
