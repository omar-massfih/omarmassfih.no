import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import nunjucks from "nunjucks";
import { JSDOM } from "jsdom";

const source = await readFile(
  new URL("../src/_includes/layouts/note.njk", import.meta.url),
  "utf8"
);
const start = source.indexOf("{%- set noteCanonicalUrl");
const end = source.indexOf("{%- set noteNavigation");
const template = source.slice(start, end);

function render(title) {
  const environment = new nunjucks.Environment(undefined, { autoescape: true });
  return environment.renderString(template, {
    title,
    site: { url: "https://example.test" },
    page: { url: "/notes/safe.html" },
  });
}

test("renders one labelled static share panel outside the note-content boundary", () => {
  const wrapper = new JSDOM(`
    <div data-note-content>Authored note</div>
    ${render("A useful note")}
  `).window.document;
  const panel = wrapper.querySelector("[data-note-share]");

  assert.equal(wrapper.querySelectorAll("[data-note-share]").length, 1);
  assert.equal(panel.getAttribute("aria-labelledby"), "note-share-heading");
  assert.equal(wrapper.querySelector("[data-note-content] [data-note-share]"), null);
  assert.equal(panel.querySelector("[data-note-share-native]").hidden, true);
  assert.equal(panel.querySelector("[data-note-share-copy]").hidden, true);
  assert.equal(panel.querySelectorAll('button[type="button"]').length, 2);
  for (const button of panel.querySelectorAll("button")) {
    assert.equal(button.getAttribute("aria-describedby"), "note-share-status");
  }
});

test("email fallback URL-encodes the title and canonical URL without allowing injection", () => {
  const title = `A&B "note"><img src=x onerror=unsafe()>`;
  const document = new JSDOM(render(title)).window.document;
  const panel = document.querySelector("[data-note-share]");
  const email = panel.querySelector(".note-share-email");
  const mailto = new URL(email.href);

  assert.equal(mailto.protocol, "mailto:");
  assert.equal(mailto.searchParams.get("subject"), `Useful note: ${title}`);
  assert.equal(
    mailto.searchParams.get("body"),
    `I thought you might find this useful: ${title}\n\nhttps://example.test/notes/safe.html`
  );
  assert.equal(panel.querySelector("img"), null);
  assert.equal(panel.dataset.shareTitle, title);
});
