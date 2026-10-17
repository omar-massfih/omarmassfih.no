import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { cleanSiteUrl } from "../src/site-urls.js";
import { normalizeNote } from "../lib/notesLoader.js";

test("converts nested website URLs and preserves queries and fragments", () => {
  assert.equal(cleanSiteUrl("/index.html"), "/");
  assert.equal(cleanSiteUrl("/about.html?from=home#contact"), "/about/?from=home#contact");
  assert.equal(cleanSiteUrl("https://omarmassfih.no/notes/rag/retrieval.html#sources"), "/notes/rag/retrieval/#sources");
  assert.equal(cleanSiteUrl("/notes/rag/retrieval/index.html"), "/notes/rag/retrieval/");
  assert.equal(cleanSiteUrl("../other.html?q=one#two", "https://omarmassfih.no/notes/rag/retrieval.html"), "/notes/other/?q=one#two");
  assert.equal(cleanSiteUrl("/notes/rag/retrieval/"), "/notes/rag/retrieval/");
});

test("preserves external URLs, fragments, assets and the Pages error document", () => {
  for (const value of ["https://docs.example.org/start.html?q=x#part", "//external.test/page.html", "mailto:me@omarmassfih.no", "#section", "?q=term", "/graph.json", "/404.html"]) {
    assert.equal(cleanSiteUrl(value), value);
  }
  assert.equal(cleanSiteUrl("https://preview.test/notes/one.html", "https://preview.test/"), "/notes/one/");
});

test("normalizes backend note and authored links before generating every consumer", () => {
  const note = normalizeNote({
    slug: "rag/retrieval", url: "/notes/rag/retrieval.html", date: "2026-10-17",
    content_html: '<h2 id="details">Details</h2><a href="../other.html?q=1#details">Other</a><a href="https://docs.example.org/page.html">Docs</a><a href="#details">Here</a><img src="image.png?v=2#preview" alt="Example">',
  });
  const document = new JSDOM(note.content_html).window.document;
  assert.equal(note.url, "/notes/rag/retrieval/");
  assert.equal(note.slug, "rag/retrieval");
  assert.deepEqual([...document.querySelectorAll("a:not(.heading-anchor)")].map((link) => link.getAttribute("href")), ["/notes/other/?q=1#details", "https://docs.example.org/page.html", "#details"]);
  assert.equal(document.querySelector("img").getAttribute("src"), "/notes/rag/image.png?v=2#preview");
  assert.equal(note.toc[0].id, "details");
});
