import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import nunjucks from "nunjucks";
import { JSDOM } from "jsdom";
import getNoteNavigation from "../lib/noteNavigation.js";
import getRelatedNotes from "../lib/relatedNotes.js";

const source = fs.readFileSync(new URL("../src/_includes/layouts/note.njk", import.meta.url), "utf8")
  .replace(/^---[\s\S]*?---/, "");
const current = {
  slug: "current", url: "/notes/current/", title: "Current note", category: "Systems",
  tags: ["systems", "storage"], date: "2026-10-18", reading_time_text: "3 min read",
  toc: [{ id: "first", text: "First section", level: 2 }],
};
const previous = { ...current, slug: "previous", url: "/notes/previous/", title: "Previous note" };
const next = { ...current, slug: "next", url: "/notes/next/", title: "Next note" };
const recommendation = (slug, tags, date) => ({
  slug, url: `/notes/${slug}/`, title: slug, category: "Other", tags, date,
});

function render(note = current, notes = [note]) {
  const environment = new nunjucks.Environment(null, { autoescape: true });
  environment.addFilter("assetHash", () => "fixture");
  environment.addFilter("graphHash", () => "fixture");
  environment.addFilter("graphNeighborhood", () => ({ nodes: [{ type: "note", label: note.title, url: note.url }] }));
  environment.addFilter("noteNavigation", getNoteNavigation);
  environment.addFilter("relatedNotes", getRelatedNotes);
  return new JSDOM(environment.renderString(source, {
    note, backendNotes: notes, title: note.title, dateText: "Oct 18",
    content: '<p>Keep the article intact.</p><h2 id="first">First section</h2>',
    noteCategories: [{ title: "Systems", url: "/notes/categories/systems/" }],
  })).window.document;
}

test("keeps article content ahead of optional discovery features", () => {
  const document = render();
  assert.equal(document.querySelector(".note-header h1").classList.contains("center"), false);
  assert.equal(document.querySelector(".note-meta").textContent.replace(/\s+/g, " ").trim(), "Oct 18 3 min read Systems");
  assert.equal(document.querySelector(".note-meta a").getAttribute("href"), "/notes/categories/systems/");
  const toc = document.querySelector("details.note-toc-disclosure");
  const graph = document.querySelector("details.note-graph");
  assert.equal(toc.open, false);
  assert.equal(graph.open, false);
  assert.equal(toc.getAttribute("name"), null);
  assert.equal(graph.getAttribute("name"), null);
  assert.equal(graph.querySelector(":scope > summary").textContent, "Explore related notes");
  assert.equal(document.querySelector(".note-tags").closest("details"), graph);
  assert.equal(graph.querySelectorAll(".note-tags .tag").length, 2);
  assert.ok(graph.querySelector(".graph-fallback a"));
  assert.equal(document.querySelector(".note-content").innerHTML.trim(), '<p>Keep the article intact.</p><h2 id="first">First section</h2>');
});

test("omits empty contents, graph, related section, and singleton navigation", () => {
  const document = render({ ...current, toc: [], tags: [] });
  assert.equal(document.querySelector(".note-toc, .note-graph, .related-notes, .note-navigation"), null);
  assert.equal(document.querySelector("script[src^='/graph.js']"), null);
  assert.ok(document.querySelector(".note-content"));
});

test("does not repeat the sole adjacent note as a related recommendation", () => {
  const document = render(current, [current, next]);
  assert.equal(document.querySelector(".note-navigation-next").getAttribute("href"), next.url);
  assert.equal(document.querySelector(".note-navigation-previous, .note-navigation-position, .related-notes"), null);
});

test("filters neighbors before limiting recommendations and preserves relevance, date, and title order", () => {
  const notes = [previous, current, next,
    recommendation("beta", ["systems"], "2025-01-01"),
    recommendation("recent", ["systems"], "2026-01-01"),
    recommendation("strong", ["systems", "storage"], "2024-01-01"),
    recommendation("alpha", ["systems"], "2025-01-01"),
    recommendation("unrelated", ["elsewhere"], "2026-10-18"),
    { ...current, slug: "same-destination" },
  ];
  assert.deepEqual(getRelatedNotes(notes, current).map(note => note.title), ["strong", "recent", "alpha"]);
  const document = render(current, notes);
  assert.equal(document.querySelectorAll(".note-navigation-link").length, 2);
  assert.deepEqual([...document.querySelectorAll(".related-note a")].map(a => a.textContent.trim()), ["strong", "recent", "alpha"]);
  assert.equal(document.querySelector(".related-notes .tag, .related-notes .list-row-meta, .note-navigation-position"), null);
});
