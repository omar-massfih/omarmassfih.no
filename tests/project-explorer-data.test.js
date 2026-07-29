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
  assert.deepEqual(explorer.technologies, ["API", "Eleventy", "Python"]);
  assert.deepEqual(explorer.sources, ["case study", "github"]);
});

test("handles missing, empty, and invalid tag arrays", () => {
  const explorer = buildProjectExplorer([
    { name: "Missing", source: "github", draft: false },
    { name: "Empty", tags: [], source: "github", draft: false },
    { name: "Invalid", tags: [null, "", "Python"], source: "", draft: false },
  ]);

  assert.equal(explorer.projects.length, 3);
  assert.deepEqual(explorer.technologies, ["Python"]);
  assert.deepEqual(explorer.sources, ["github"]);
});
