import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import nunjucks from "nunjucks";
import { JSDOM } from "jsdom";

const source = await readFile(new URL("../src/notes.html", import.meta.url), "utf8");
const template = source.replace(/^---[\s\S]*?---/, "");

function render(notes) {
  const environment = new nunjucks.Environment();
  environment.addFilter("graphHash", () => "graph");
  environment.addFilter("assetHash", () => "asset");
  environment.addFilter("notesSearchJson", () => "[]");
  return environment.renderString(template, { backendNotes: notes });
}

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
