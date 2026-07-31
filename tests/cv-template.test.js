import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import nunjucks from "nunjucks";
import { JSDOM } from "jsdom";

const source = fs.readFileSync("src/cv.html", "utf8").replace(/^---[\s\S]*?---\s*/, "");
const environment = new nunjucks.Environment(null, { autoescape: true });
const fixture = {
  experience: [
    { company: "First <em>Co</em>", title: "Lead", meta: "Now", bullets: ["Built <b>it</b>"], tech: ["JS"] },
    { company: "Second", title: "Engineer", meta: "Before", bullets: ["Shipped"], tech: ["CSS"] },
  ],
  skills: [
    { group: "Platform", items: ["Cloud", "Linux"] },
    { group: "Languages", items: ["JavaScript"] },
  ],
  education: [
    { school: "University", degree: "MSc", meta: "Grade A" },
    { school: "College", degree: "BSc", meta: "Grade B" },
  ],
  certifications: [
    { issuer: "Issuer A", items: ["Credential 1", "Credential 2"] },
    {
      issuer: "Issuer B",
      items: ["Credential 3", "Credential 4", "Credential 5", "Credential 6", "Credential 7", "Credential 8", "Credential 9"],
    },
  ],
};
const render = () => new JSDOM(environment.renderString(source, { cv: fixture })).window.document;
const textsWithin = (element, selector) =>
  [...element.querySelectorAll(selector)].map((node) => node.textContent.trim());

test("renders ordered experience and every data-driven CV row in source order", () => {
  const document = render();
  assert.deepEqual(
    [...document.querySelectorAll(".cv-role .cv-kicker")].map((node) => node.textContent.trim()),
    fixture.experience.map((role) => role.company)
  );
  assert.equal(document.querySelectorAll(".cv-role").length, fixture.experience.length);
  assert.equal(document.querySelectorAll(".cv-skill-row").length, fixture.skills.length);
  assert.equal(document.querySelectorAll(".cv-education-row").length, fixture.education.length);
  assert.equal(document.querySelectorAll(".cv-credential-group").length, fixture.certifications.length);
  assert.deepEqual(
    [...document.querySelectorAll(".cv-skill-row .cv-kicker")].map((node) => node.textContent),
    fixture.skills.map((group) => group.group)
  );

  [...document.querySelectorAll(".cv-role")].forEach((role, index) => {
    assert.equal(role.querySelector(".cv-kicker").textContent.trim(), fixture.experience[index].company);
    assert.equal(role.querySelector("h3").textContent.trim(), fixture.experience[index].title);
    assert.equal(role.querySelector(".cv-meta").textContent.trim(), fixture.experience[index].meta);
    assert.deepEqual(textsWithin(role, ".cv-list li"), fixture.experience[index].bullets);
    assert.deepEqual(textsWithin(role, ".tag"), fixture.experience[index].tech);
  });

  [...document.querySelectorAll(".cv-skill-row")].forEach((panel, index) => {
    assert.equal(panel.querySelector(".cv-kicker").textContent.trim(), fixture.skills[index].group);
    assert.deepEqual(textsWithin(panel, ".tag"), fixture.skills[index].items);
  });

  [...document.querySelectorAll(".cv-education-row")].forEach((card, index) => {
    assert.equal(card.querySelector(".cv-kicker").textContent.trim(), fixture.education[index].school);
    assert.equal(card.querySelector("h3").textContent.trim(), fixture.education[index].degree);
    assert.equal(card.querySelector(".cv-meta").textContent.trim(), fixture.education[index].meta);
  });

  [...document.querySelectorAll(".cv-credential-group")].forEach((card, index) => {
    assert.equal(card.querySelector(".cv-kicker").textContent.trim(), fixture.certifications[index].issuer);
    assert.deepEqual(textsWithin(card, "li"), fixture.certifications[index].items);
    assert.equal(card.classList.contains("cv-credential-group--long"), fixture.certifications[index].items.length > 6);
  });
});

test("preserves headings, links, and print behavior", () => {
  const document = render();
  assert.equal(document.querySelectorAll("h1").length, 1);
  assert.ok(document.querySelector("#skills"));
  assert.equal(document.querySelector('#skills a').getAttribute("href"), "/skills.html");
  const credly = document.querySelector('a[href^="https://www.credly.com/"]');
  assert.equal(credly.getAttribute("target"), "_blank");
  assert.equal(credly.getAttribute("rel"), "me noopener");
  const button = document.querySelector(".print-button");
  assert.equal(button.getAttribute("type"), "button");
  assert.equal(button.getAttribute("onclick"), "window.print()");
});

test("escapes values supplied by CV data", () => {
  const document = render();
  assert.equal(document.querySelector(".cv-kicker").innerHTML, "First &lt;em&gt;Co&lt;/em&gt;");
  assert.equal(document.querySelector(".cv-list li").innerHTML, "Built &lt;b&gt;it&lt;/b&gt;");
  assert.equal(document.querySelector(".cv-kicker em"), null);
  assert.equal(document.querySelector(".cv-list li b"), null);
});
