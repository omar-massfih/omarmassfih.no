import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import nunjucks from "nunjucks";
import { JSDOM } from "jsdom";
import buildProjectExplorer from "../lib/projectExplorer.js";

const source = await readFile(new URL("../src/projects.html", import.meta.url), "utf8");
const template = source.replace(/^---[\s\S]*?---/, "");

function render(projects) {
  const environment = new nunjucks.Environment();
  environment.addFilter("projectExplorer", buildProjectExplorer);
  environment.addFilter("dump", JSON.stringify);
  environment.addFilter("assetHash", () => "fixturehash");
  return environment.renderString(template, { projects });
}

const fixtures = [
  {
    name: "First <build>",
    summary: "A clear <summary>",
    description: "A detailed <description>",
    tags: ["Node <JS>", "CSS"],
    url: "/first.html?value=<unsafe>",
    source: "github",
  },
  {
    name: "Featured <study>",
    summary: "Featured <summary>",
    description: "Featured <description>",
    tags: ["Eleventy", "FastAPI"],
    url: "/featured.html?value=<unsafe>",
    source: "case study",
  },
  {
    name: "Last project",
    summary: "Last summary",
    description: "Last description",
    tags: ["Python"],
    url: "https://example.test/last",
    source: "github",
  },
];

test("renders one featured case study before ordered responsive standard cards", () => {
  const document = new JSDOM(render(fixtures)).window.document;
  const results = document.querySelector("[data-project-results].project-results");
  const featuredRegion = results.querySelector(":scope > .featured-project-region");
  const standardRegion = results.querySelector(":scope > .standard-projects");
  const featured = featuredRegion.querySelector(".project-box--featured");
  const standardCards = [...standardRegion.querySelectorAll(".card-grid > .project-box--standard")];

  assert.equal(document.querySelectorAll(".project-box--featured").length, 1);
  assert.equal(
    featuredRegion.compareDocumentPosition(standardRegion) &
      document.defaultView.Node.DOCUMENT_POSITION_FOLLOWING,
    document.defaultView.Node.DOCUMENT_POSITION_FOLLOWING
  );
  assert.equal(featured.querySelector("h2").textContent.trim(), "Featured <study>");
  assert.deepEqual(
    standardCards.map((card) => card.querySelector("h3").textContent.trim().replace(/\s+/g, " ")),
    ["First <build>", "Last project"]
  );
  assert.equal(document.querySelectorAll(".project-box").length, fixtures.length);
  assert.equal(document.querySelector("script").getAttribute("src"),
    "/projects-filter.js?v=fixturehash");
});

test("represents complete escaped project content and filter metadata", () => {
  const document = new JSDOM(render(fixtures)).window.document;
  const cards = [...document.querySelectorAll("[data-project-results] .project-box")];
  const renderedOrder = [fixtures[1], fixtures[0], fixtures[2]];

  for (const [index, project] of renderedOrder.entries()) {
    const card = cards[index];
    assert.equal(card.dataset.source, project.source);
    assert.deepEqual(JSON.parse(card.dataset.technologies), project.tags);
    assert.match(card.textContent, new RegExp(project.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(card.textContent, new RegExp(project.summary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(card.textContent, new RegExp(project.description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(card.querySelector("a").getAttribute("href"), project.url);
    assert.deepEqual(
      [...card.querySelectorAll(".tag")].map((tag) => tag.textContent),
      project.tags
    );
    assert.equal(card.hidden, false);
  }

  assert.equal(document.querySelector("script:not([src])"), null);
  assert.equal(document.querySelector("strong"), null);
  assert.equal(document.querySelector(".project-summary").textContent, "Featured <summary>");
  assert.equal(document.querySelector(".tag").textContent, "Eleventy");
});

test("uses semantic section headings and labeled technology lists", () => {
  const document = new JSDOM(render(fixtures)).window.document;

  assert.equal(document.querySelector(".project-intro > h1").textContent, "Projects");
  assert.equal(document.querySelector(".featured-project-region h2").textContent.trim(),
    "Featured <study>");
  assert.equal(document.querySelector(".standard-projects > header > h2").textContent,
    "More projects");
  assert.equal(document.querySelectorAll(".project-box--standard h3").length, 2);

  for (const list of document.querySelectorAll(".project-box .tag-list")) {
    const labelId = list.getAttribute("aria-labelledby");
    assert.ok(labelId);
    assert.equal(document.getElementById(labelId).textContent, "Technologies");
  }

  assert.equal(document.querySelector(".project-filter").hidden, true);
  assert.equal(document.querySelector("[data-project-empty]").hidden, true);
  assert.equal(document.querySelectorAll(".project-box[hidden]").length, 0);
});

test("omits the featured region safely when no case study exists", () => {
  const document = new JSDOM(render([fixtures[0], fixtures[2]])).window.document;

  assert.equal(document.querySelector(".featured-project-region"), null);
  assert.deepEqual(
    [...document.querySelectorAll(".card-grid .project-box")].map(
      (card) => card.querySelector("h3").textContent.trim().replace(/\s+/g, " ")
    ),
    ["First <build>", "Last project"]
  );
});
