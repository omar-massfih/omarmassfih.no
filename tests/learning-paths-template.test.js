import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import nunjucks from "nunjucks";
import { JSDOM } from "jsdom";

const source = await readFile(
  new URL("../src/learning-paths.html", import.meta.url),
  "utf8"
);
const template = source.replace(/^---[\s\S]*?---/, "");

function render(learningPaths) {
  return new nunjucks.Environment().renderString(template, { learningPaths });
}

test("renders escaped, ordered paths and ordinary note links without scripts", () => {
  const document = new JSDOM(render([
    {
      slug: "one",
      title: "First <path>",
      description: "Start <strong>here</strong>",
      note_count: 2,
      total_reading_time_text: "7 min total",
      notes: [
        {
          url: "/notes/first.html",
          list_title: "First <note>",
          reading_time_text: "2 min read",
          description: "Unsafe <script>content</script>",
        },
        {
          url: "/notes/second.html",
          title: "Second",
          reading_time_text: "5 min read",
        },
      ],
    },
    {
      slug: "two",
      title: "Second path",
      description: "Continue",
      note_count: 1,
      total_reading_time_text: "3 min total",
      notes: [{
        url: "/notes/third.html",
        title: "Third",
        reading_time_text: "3 min read",
      }],
    },
  ])).window.document;

  assert.deepEqual(
    [...document.querySelectorAll(".learning-path > .learning-path-head > h2")]
      .map((heading) => heading.textContent),
    ["First <path>", "Second path"]
  );
  const lists = [...document.querySelectorAll(".learning-path > ol.learning-path-steps")];
  assert.equal(lists.length, 2);
  assert.deepEqual(
    [...lists[0].querySelectorAll(":scope > li > a")].map((link) => link.getAttribute("href")),
    ["/notes/first.html", "/notes/second.html"]
  );
  assert.equal(document.querySelector(".learning-path-head p").textContent.trim(),
    "Start <strong>here</strong>");
  assert.equal(document.querySelector(".list-row-title").textContent, "First <note>");
  assert.equal(document.querySelector(".note-preview-description").textContent,
    "Unsafe <script>content</script>");
  assert.match(document.querySelector(".learning-path-meta").textContent, /2 notes · 7 min total/);
  assert.deepEqual(
    [...document.querySelectorAll(".list-row-meta")].map((meta) => meta.textContent),
    ["2 min read", "5 min read", "3 min read"]
  );
  assert.equal(document.querySelector("script"), null);
  assert.equal(document.querySelector("button, input, [role=button]"), null);
  assert.equal(document.querySelector('a[href="/notes.html"]').textContent.trim(), "← All notes");
});

test("notes index exposes a static learning-path link", async () => {
  const notesIndex = await readFile(new URL("../src/notes.html", import.meta.url), "utf8");
  assert.match(
    notesIndex,
    /<a href="\/learning-paths\.html">Follow a curated learning path<\/a>/
  );
  assert.doesNotMatch(
    notesIndex,
    /<[^>]+hidden[^>]*>[\s\S]*?<a href="\/learning-paths\.html">/
  );
});
