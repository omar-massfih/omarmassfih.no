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

test("renders ordered project rows", () => {
  const document = new JSDOM(render(fixtures)).window.document;
  const results = document.querySelector("[data-project-results].project-results.project-list");
  const rows = [...results.querySelectorAll(":scope > .project-row")];

  assert.deepEqual(
    rows.map((row) => row.querySelector("h2").textContent.trim().replace(/\s+/g, " ")),
    fixtures.map(({ name }) => name)
  );
  assert.equal(document.querySelectorAll(".project-row").length, fixtures.length);
  assert.equal(document.querySelector("script").getAttribute("src"),
    "/projects-filter.js?v=fixturehash");
});

test("represents complete escaped project content and filter metadata", () => {
  const document = new JSDOM(render(fixtures)).window.document;
  const rows = [...document.querySelectorAll("[data-project-results] .project-row")];

  for (const [index, project] of fixtures.entries()) {
    const row = rows[index];
    assert.equal(row.dataset.source, project.source);
    assert.deepEqual(JSON.parse(row.dataset.technologies), project.tags);
    assert.match(row.textContent, new RegExp(project.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(row.textContent, new RegExp(project.summary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(row.textContent, new RegExp(project.description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(row.querySelector("a").getAttribute("href"), project.url);
    assert.deepEqual(
      [...row.querySelectorAll(".tag")].map((tag) => tag.textContent),
      project.tags
    );
    assert.equal(row.hidden, false);
  }

  assert.equal(document.querySelector("script:not([src])"), null);
  assert.equal(document.querySelector("strong"), null);
  assert.equal(document.querySelector(".project-summary").textContent, "A clear <summary>");
  assert.equal(document.querySelector(".tag").textContent, "Node <JS>");
});

test("uses semantic heading and labeled technology lists", () => {
  const document = new JSDOM(render(fixtures)).window.document;

  assert.equal(document.querySelector("h1").textContent, "Projects");
  assert.equal(document.querySelectorAll(".project-row h2").length, fixtures.length);

  for (const list of document.querySelectorAll(".project-row .tag-list")) {
    assert.equal(list.getAttribute("aria-label"), "Technologies");
  }

  assert.equal(document.querySelector(".project-filter").hidden, true);
  assert.equal(document.querySelector("[data-project-empty]").hidden, true);
  assert.equal(document.querySelectorAll(".project-row[hidden]").length, 0);
});

test("renders the same simple list when no case study exists", () => {
  const document = new JSDOM(render([fixtures[0], fixtures[2]])).window.document;

  assert.equal(document.querySelector(".featured-project-region"), null);
  assert.deepEqual(
    [...document.querySelectorAll(".project-list .project-row")].map(
      (row) => row.querySelector("h2").textContent.trim().replace(/\s+/g, " ")
    ),
    ["First <build>", "Last project"]
  );
});
