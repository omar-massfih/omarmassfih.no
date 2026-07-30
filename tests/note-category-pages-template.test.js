import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import nunjucks from "nunjucks";
import { JSDOM } from "jsdom";

const source = await readFile(
  new URL("../src/backend-note-category-pages.njk", import.meta.url),
  "utf8"
);
const template = source.replace(/^---[\s\S]*?---/, "");

function render(category) {
  return new nunjucks.Environment().renderString(template, { category });
}

test("renders a focused static category with escaped existing previews", () => {
  const description = "<script>unsafe()</script> & detail";
  const tag = "<img onerror=unsafe>";
  const document = new JSDOM(render({
    title: "Platform",
    count: 2,
    notes: [
      {
        url: "/notes/one.html",
        title: "One",
        date_text: "Jul 30",
        reading_time_text: "2 min read",
        description,
        tags: [tag],
      },
      { url: "/notes/two.html", title: "Two", tags: [] },
    ],
  })).window.document;

  assert.equal(document.querySelector("h1").textContent, "Platform");
  assert.equal(document.querySelector(".category-note-count").textContent.trim(), "2 notes");
  assert.deepEqual(
    [...document.querySelectorAll(".notes-list > .list-row")].map((row) => row.getAttribute("href")),
    ["/notes/one.html", "/notes/two.html"]
  );
  assert.equal(document.querySelector(".note-preview-description").textContent, description);
  assert.equal(document.querySelector(".note-preview-tags .tag").textContent, tag);
  assert.equal(document.querySelector(".notes-list script"), null);
  assert.equal(document.querySelector(".notes-list img"), null);
  assert.equal(document.querySelector('a[href="/notes.html"]').textContent.trim(), "← All notes");
});

test("renders the singular note count", () => {
  const document = new JSDOM(render({
    title: "Singleton",
    count: 1,
    notes: [{ url: "/notes/only.html", title: "Only", tags: [] }],
  })).window.document;

  assert.equal(document.querySelector(".category-note-count").textContent.trim(), "1 note");
});

test("index category controls and note templates use derived category URLs", async () => {
  const index = await readFile(new URL("../src/notes.html", import.meta.url), "utf8");
  const note = await readFile(
    new URL("../src/_includes/layouts/note.njk", import.meta.url),
    "utf8"
  );

  assert.match(
    index,
    /<a href="{{ category\.url }}" class="tag tag-filter" data-category="{{ category\.title }}" aria-pressed="false">/
  );
  assert.doesNotMatch(index, /<button[^>]+data-category=/);
  assert.match(note, /href="{{ noteCategory\.url }}"/);
});
