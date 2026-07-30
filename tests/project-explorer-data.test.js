import assert from "node:assert/strict";
import test from "node:test";
import buildProjectExplorer from "../lib/projectExplorer.js";

test("excludes drafts and derives sorted, unique facets", () => {
  const projects = [
    { name: "Zulu", tags: ["Python", "API", "Python"], source: "github", draft: false },
    { name: "Draft", tags: ["Secret"], source: "internal", draft: true },
    { name: "Alpha", tags: ["Eleventy"], source: "case study", draft: false },
  ];

  const explorer = buildProjectExplorer(projects);

  assert.deepEqual(explorer.projects.map(({ name }) => name), ["Zulu", "Alpha"]);
  assert.equal(explorer.featuredProject.name, "Alpha");
  assert.deepEqual(explorer.standardProjects.map(({ name }) => name), ["Zulu"]);
  assert.deepEqual(explorer.technologies, ["API", "Eleventy", "Python"]);
  assert.deepEqual(explorer.sources, ["case study", "github"]);
});

test("selects the first published case study by source and preserves source order", () => {
  const projects = [
    { name: "First", tags: [], source: "github" },
    { name: "Featured", tags: [], source: "case study" },
    { name: "Later", tags: [], source: "github" },
    { name: "Second case study", tags: [], source: "case study" },
    { name: "Draft case study", tags: [], source: "case study", draft: true },
  ];

  const explorer = buildProjectExplorer(projects);

  assert.equal(explorer.featuredProject, projects[1]);
  assert.deepEqual(
    explorer.standardProjects.map(({ name }) => name),
    ["First", "Later", "Second case study"]
  );
  assert.deepEqual(
    explorer.projects.map(({ name }) => name),
    ["First", "Featured", "Later", "Second case study"]
  );
  assert.equal(explorer.projects.some(({ draft }) => draft), false);
  assert.equal(explorer.standardProjects.some(({ draft }) => draft), false);
});

test("degrades safely when no published case study exists", () => {
  const projects = [
    { name: "First", tags: [], source: "github" },
    { name: "Draft", tags: [], source: "case study", draft: true },
    { name: "Last", tags: [], source: "internal" },
  ];

  const explorer = buildProjectExplorer(projects);

  assert.equal(explorer.featuredProject, undefined);
  assert.deepEqual(explorer.standardProjects, explorer.projects);
  assert.deepEqual(explorer.standardProjects.map(({ name }) => name), ["First", "Last"]);
});

test("handles missing, empty, and invalid tag arrays", () => {
  const explorer = buildProjectExplorer([
    { name: "Missing", source: "github", draft: false },
    { name: "Empty", tags: [], source: "github", draft: false },
    { name: "Invalid", tags: [null, "", "Python"], source: "", draft: false },
  ]);

  assert.equal(explorer.projects.length, 3);
  assert.equal(explorer.featuredProject, undefined);
  assert.equal(explorer.standardProjects.length, 3);
  assert.deepEqual(explorer.technologies, ["Python"]);
  assert.deepEqual(explorer.sources, ["github"]);
});
