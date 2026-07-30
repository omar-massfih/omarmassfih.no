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

test("renders a semantic portrait-led biography", () => {
  const document = render();
  assert.equal(document.querySelectorAll("h1").length, 1);
  assert.ok(document.querySelector("main > section.about-intro"));

  const portrait = document.querySelector(".portrait img");
  assert.equal(portrait.getAttribute("src"), "/bilder/1690240717543.jpeg");
  assert.ok(portrait.getAttribute("alt").trim());
  assert.equal(portrait.getAttribute("width"), "800");
  assert.equal(portrait.getAttribute("height"), "800");
});

test("retains career, platform engineering, and certification biography details", () => {
  const document = render();
  const text = document.querySelector(".about-copy").textContent.replace(/\s+/g, " ");
  for (const detail of ["BAMA", "IBM", "University of Oslo"]) assert.match(text, new RegExp(detail, "i"));
  for (const detail of [
    "Python", "dlt", "dbt", "Azure", "Snowflake", "LangGraph", "LangChain",
    "Terraform", "CI/CD", "Kubernetes", "OpenShift", "10 Azure", "6 Red Hat",
  ]) {
    assert.ok(text.includes(detail), `Missing platform detail: ${detail}`);
  }
});

test("provides exact internal pathways and existing contact destinations", () => {
  const document = render();
  for (const href of internalPaths) {
    assert.ok(document.querySelector(`.about-copy a[href="${href}"]`));
  }
  for (const href of contacts) {
    const link = document.querySelector(`.contact a[href="${href}"]`);
    assert.ok(link, `Missing contact: ${href}`);
    assert.ok(link.textContent.trim(), `Contact lacks accessible text: ${href}`);
  }
});

test("exposes simple layout hooks without adding dynamic About behavior", () => {
  const document = render();
  assert.ok(document.querySelector(".about-intro-body .about-copy"));
  assert.ok(document.querySelector("figure.portrait"));
  assert.ok(document.querySelector("section.contact"));
  assert.equal(document.querySelector("[data-about-app], #about-app"), null);
  assert.equal(document.querySelector("script"), null);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});
