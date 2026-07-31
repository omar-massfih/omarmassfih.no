import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import nunjucks from "nunjucks";
import { JSDOM } from "jsdom";
import buildNoteCategories from "../lib/noteCategories.js";

const source = await readFile(new URL("../src/notes.html", import.meta.url), "utf8");
const template = source.replace(/^---[\s\S]*?---/, "");

function render(notes) {
  const environment = new nunjucks.Environment();
  environment.addFilter("graphHash", () => "graph");
  environment.addFilter("assetHash", () => "asset");
  environment.addFilter("notesSearchJson", () => "[]");
  return environment.renderString(template, {
    backendNotes: notes,
    noteCategories: buildNoteCategories(notes),
  });
}

test("renders the notes index structure, accessible filters, and category counts", () => {
  const html = render([
    {
      url: "/notes/first.html",
      title: "First",
      category: "Tests",
      tags: [],
    },
    {
      url: "/notes/second.html",
      title: "Second",
      category: "Tests",
      tags: [],
    },
  ]);
  const document = new JSDOM(html).window.document;
  const main = document.querySelector("main.notes-index");
  const filter = main.querySelector(".notes-filter");
  const heading = main.querySelector(".notes-list > .notes-head");
  const graphDisclosure = main.querySelector(".graph-disclosure");

  assert.ok(main.querySelector(".notes-intro"));
  assert.ok(graphDisclosure);
  assert.equal(graphDisclosure.hasAttribute("open"), false);
  assert.equal(graphDisclosure.querySelector("summary").textContent.trim(), "Explore note graph");
  assert.ok(graphDisclosure.querySelector(".knowledge-graph"));
  assert.equal(filter.hasAttribute("hidden"), true);
  assert.equal(filter.getAttribute("aria-label"), "Filter notes");
  assert.equal(
    filter.querySelector('label[for="notes-search-input"]').textContent.trim(),
    "Search notes"
  );
  assert.equal(
    filter.querySelector(".notes-filter-categories").getAttribute("aria-labelledby"),
    "notes-category-filter-label"
  );
  assert.equal(heading.querySelector(".category-note-count").textContent.trim(), "2 notes");
  assert.equal(heading.nextElementSibling.matches(".list-row"), true);
});

test("renders descriptions and tags as plain text when metadata contains HTML characters", () => {
  const description = 'Compare <script>alert("description")</script> & "quoted" values';
  const tag = '<img src=x onerror="alert(\'tag\')">&';
  const html = render([{
    url: "/notes/escaping.html",
    title: "Escaping",
    category: "Tests",
    date_text: "Jul 30",
    reading_time_text: "1 min read",
    description,
    tags: [tag],
  }]);
  const document = new JSDOM(html).window.document;
  const row = document.querySelector(".notes-list > .list-row");

  assert.equal(row.querySelector(".note-preview-description").textContent, description);
  assert.equal(row.querySelector(".note-preview-tags > .tag").textContent, tag);
  assert.equal(row.querySelector("script"), null);
  assert.equal(row.querySelector("img"), null);
});
