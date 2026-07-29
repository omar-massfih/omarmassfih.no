import assert from "node:assert/strict";
import test from "node:test";
import { normalizeNote } from "../lib/notesLoader.js";
import calculateReadingTime from "../lib/readingTime.js";

function words(count) {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}

test("uses a one-minute minimum and rounds up at 200 words per minute", () => {
  for (const html of ["", "   ", "<p> </p>", "<script>ignored words</script>"]) {
    assert.equal(calculateReadingTime(html), 1);
  }

  assert.equal(calculateReadingTime(words(1)), 1);
  assert.equal(calculateReadingTime(words(200)), 1);
  assert.equal(calculateReadingTime(words(201)), 2);
  assert.equal(calculateReadingTime(words(400)), 2);
});

test("counts rendered text instead of markup and normalizes whitespace", () => {
  const filler = words(195);
  const compact = `<p>${filler}</p><h2>One &amp; two</h2><p>three <strong>four</strong></p>`;
  const spaced = `<p>${filler}</p><h2>\n One   &amp;\t two </h2><p> three <strong>four</strong> </p>`;

  assert.equal(calculateReadingTime(compact), 1);
  assert.equal(calculateReadingTime(spaced), calculateReadingTime(compact));
});

test("separates words in adjacent block elements", () => {
  const html = Array.from({ length: 201 }, (_, index) => `<p>word${index}</p>`).join("");

  assert.equal(calculateReadingTime(html), 2);
});

test("excludes non-readable element contents", () => {
  const ignored = words(400);
  const html = [
    "<p>Visible text</p>",
    `<script>${ignored}</script>`,
    `<style>${ignored}</style>`,
    `<template>${ignored}</template>`,
    `<noscript>${ignored}</noscript>`,
  ].join("");

  assert.equal(calculateReadingTime(html), 1);
});

test("returns the same estimate for identical input", () => {
  const html = `<article>${words(201)}</article>`;

  assert.equal(calculateReadingTime(html), calculateReadingTime(html));
});

test("normalization attaches body-derived reading metadata before heading processing", () => {
  const body = `<h2>Body heading</h2><p>${words(198)}</p>`;
  const note = normalizeNote({
    slug: "reading-time",
    date: "2026-01-01",
    title: words(400),
    description: words(400),
    tags: [words(400)],
    content_html: body,
  });

  assert.equal(note.reading_time_minutes, 1);
  assert.equal(note.reading_time_text, "1 min read");
  assert.match(note.content_html, /heading-anchor/);
  assert.equal(calculateReadingTime(note.content_html), note.reading_time_minutes);
});
