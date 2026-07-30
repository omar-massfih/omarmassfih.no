import assert from "node:assert/strict";
import test from "node:test";
import buildNotesGraph, { getNotesGraphNeighborhood } from "../lib/notesGraph.js";

const notes = [
  { slug: "alpha", title: "Alpha", category: "Systems", url: "/notes/alpha.html", tags: ["scale", "data"] },
  { slug: "beta", list_title: "Beta list", title: "Beta", category: "RAG", url: "/notes/beta.html", tags: ["scale", "data", "ai"] },
  { slug: "gamma", title: "Gamma", category: "Systems", url: "/notes/gamma.html", tags: ["other"] },
  { slug: "plain", title: "Plain", url: "/notes/plain.html" },
];

test("builds note, tag, relationship, and weighted related-note records", () => {
  const graph = buildNotesGraph(notes);
  assert.deepEqual(graph.nodes.find(({ id }) => id === "note:beta"), {
    id: "note:beta", type: "note", label: "Beta list", category: "RAG", url: "/notes/beta.html",
  });
  assert.equal(graph.nodes.filter(({ type }) => type === "tag").length, 4);
  assert(graph.links.some(({ source, target }) => source === "note:alpha" && target === "tag:scale"));
  assert.deepEqual(
    graph.links.find(({ source, target }) => source === "note:alpha" && target === "note:beta"),
    { source: "note:alpha", target: "note:beta", weight: 2 }
  );
});

test("returns the root, its tags, notes sharing them, and only internal edges", () => {
  const local = getNotesGraphNeighborhood(buildNotesGraph(notes), "note:alpha");
  assert.deepEqual(local.nodes.map(({ id }) => id), [
    "note:alpha", "note:beta", "tag:scale", "tag:data",
  ]);
  const ids = new Set(local.nodes.map(({ id }) => id));
  assert(local.links.every(({ source, target }) => ids.has(source) && ids.has(target)));
  assert(!local.nodes.some(({ id }) => id === "note:gamma"));
});

test("handles empty graphs, missing roots, and tagless roots", () => {
  assert.deepEqual(getNotesGraphNeighborhood({}, "note:alpha"), { nodes: [], links: [] });
  assert.deepEqual(getNotesGraphNeighborhood(buildNotesGraph(notes), "note:missing"), { nodes: [], links: [] });
  assert.deepEqual(getNotesGraphNeighborhood(buildNotesGraph(notes), "note:plain"), {
    nodes: [{ id: "note:plain", type: "note", label: "Plain", category: "Notes", url: "/notes/plain.html" }],
    links: [],
  });
});
