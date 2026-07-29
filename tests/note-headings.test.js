import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";
import nunjucks from "nunjucks";
import processNoteHeadings from "../lib/noteHeadings.js";

function parse(result) {
  return new JSDOM(`<body>${result.content_html}</body>`).window.document;
}

test("adds stable IDs, permalinks, and matching TOC entries", () => {
  const result = processNoteHeadings("<h2>Install the API</h2><p>First step.</p>");
  const document = parse(result);
  const heading = document.querySelector("h2");
  const anchor = heading.querySelector(".heading-anchor");

  assert.equal(heading.id, "install-the-api");
  assert.equal(anchor.getAttribute("href"), "#install-the-api");
  assert.equal(anchor.getAttribute("aria-label"), "Permalink to Install the API");
  assert.equal(anchor.querySelector("[aria-hidden=true]").textContent, "#");
  assert.deepEqual(result.toc, [{ id: "install-the-api", text: "Install the API", level: 2 }]);
});

test("suffixes repeated headings deterministically", () => {
  const result = processNoteHeadings("<h2>Verify</h2><h2>Verify</h2><h3>Verify</h3>");

  assert.deepEqual(result.toc.map(({ id }) => id), ["verify", "verify-2", "verify-3"]);
});

test("slugs visible text containing markup, entities, punctuation, Unicode, and whitespace", () => {
  const result = processNoteHeadings(
    "<h2>  Déploy <em>API</em> &amp; test!  </h2><h2>東京 🚀</h2>"
  );

  assert.deepEqual(result.toc, [
    { id: "deploy-api-test", text: "Déploy API & test!", level: 2 },
    { id: "section", text: "東京 🚀", level: 2 },
  ]);
});

test("uses deterministic fallbacks for empty and non-sluggable headings", () => {
  const result = processNoteHeadings("<h2></h2><h3>!!!</h3><h2>東京</h2>");

  assert.deepEqual(result.toc.map(({ id }) => id), ["section", "section-2", "section-3"]);
});

test("preserves valid authored IDs and includes them in collision detection", () => {
  const result = processNoteHeadings(
    '<h2>Stable link</h2><h2 id="stable-link">Later</h2>'
  );

  assert.deepEqual(result.toc.map(({ id }) => id), ["stable-link-2", "stable-link"]);
});

test("preserves authored IDs containing a hash and encodes their fragment links", () => {
  const result = processNoteHeadings('<h2 id="part#one">Stable link</h2>');
  const heading = parse(result).querySelector("h2");

  assert.equal(heading.id, "part#one");
  assert.equal(heading.querySelector(".heading-anchor").getAttribute("href"), "#part%23one");
  assert.deepEqual(result.toc, [
    { id: "part#one", text: "Stable link", level: 2 },
  ]);
});

test("rejects the layout-reserved TOC heading ID on authored body headings", () => {
  const result = processNoteHeadings(
    '<h2 id="note-toc-heading">Body heading</h2>'
  );

  assert.deepEqual(result.toc, [
    { id: "note-toc-heading-2", text: "Body heading", level: 2 },
  ]);
});

test("suffixes an authored heading ID already owned by a body element", () => {
  const result = processNoteHeadings(
    '<div id="details"></div><h2 id="details">Heading</h2>'
  );
  const document = parse(result);
  const heading = document.querySelector("h2");

  assert.equal(heading.id, "details-2");
  assert.equal(document.getElementById("details"), document.querySelector("div"));
  assert.equal(heading.querySelector(".heading-anchor").getAttribute("href"), "#details-2");
  assert.deepEqual(result.toc, [
    { id: "details-2", text: "Heading", level: 2 },
  ]);
});

test("avoids non-heading, layout-owned, and duplicate authored IDs", () => {
  const result = processNoteHeadings(
    '<div id="details"></div><h2>Details</h2>' +
      '<h2>Note toc heading</h2>' +
      '<h2 id="kept">First</h2><h3 id="kept">Second</h3>'
  );

  assert.deepEqual(result.toc.map(({ id }) => id), [
    "details-2",
    "note-toc-heading-2",
    "kept-2",
    "kept-3",
  ]);
});

test("retains h2 and h3 document order and levels", () => {
  const result = processNoteHeadings("<h2>One</h2><h3>Details</h3><h2>Two</h2>");

  assert.deepEqual(result.toc, [
    { id: "one", text: "One", level: 2 },
    { id: "details", text: "Details", level: 3 },
    { id: "two", text: "Two", level: 2 },
  ]);
});

test("leaves notes without subheadings unchanged and emits no TOC or anchors", () => {
  const html = "<p>Paragraph-only note &amp; its <strong>markup</strong>.</p>";
  const result = processNoteHeadings(html);

  assert.equal(result.content_html, html);
  assert.deepEqual(result.toc, []);
  assert.equal(result.content_html.includes("heading-anchor"), false);
});

test("renders deterministic duplicate-heading and heading-free note fixtures", () => {
  const fixtures = JSON.parse(
    fs.readFileSync(new URL("./fixtures/note-heading-notes.json", import.meta.url), "utf8")
  );
  const includesDir = path.resolve("src/_includes");
  const layoutSource = fs
    .readFileSync(path.join(includesDir, "layouts/note.njk"), "utf8")
    .replace(/^---\n[\s\S]*?\n---\n/, "");
  const environment = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(includesDir),
    { autoescape: true }
  );
  environment.addFilter("assetHash", () => "fixture");
  environment.addFilter("graphHash", () => "fixture");
  environment.addFilter("relatedNotes", () => []);
  environment.addFilter("noteNavigation", () => ({
    previous: null,
    next: null,
    position: 0,
    total: 0,
  }));

  for (const fixture of fixtures) {
    const processed = processNoteHeadings(fixture.content_html);
    const html = environment.renderString(layoutSource, {
      backendNotes: [],
      content: processed.content_html,
      dateIso: "2026-01-01T00:00:00.000Z",
      note: { ...fixture, toc: processed.toc, tags: [] },
      page: { url: `/notes/${fixture.slug}.html` },
      site: {
        title: "Fixture site",
        description: "Fixture description",
        url: "https://example.test",
        ogImage: "/og.png",
        ogImageAlt: "Fixture",
      },
      title: fixture.title,
    });
    const document = new JSDOM(html).window.document;
    const headings = [...document.querySelectorAll("main.note > section:first-child h2:not(#note-toc-heading), main.note > section:first-child h3")];
    const toc = document.querySelector("nav.note-toc");

    assert.equal(Boolean(toc), fixture.expectToc, fixture.slug);
    assert.equal(document.querySelectorAll("#note-toc-heading").length, fixture.expectToc ? 1 : 0, fixture.slug);
    if (toc) {
      assert.equal(
        document.getElementById(toc.getAttribute("aria-labelledby"))?.textContent,
        "On this page",
        fixture.slug
      );
    }
    assert.deepEqual(headings.map(({ id }) => id), fixture.expectedIds, fixture.slug);
    for (const heading of headings) {
      const target = decodeURIComponent(heading.querySelector(".heading-anchor").hash.slice(1));
      assert.equal(document.getElementById(target), heading, fixture.slug);
    }
  }
});
