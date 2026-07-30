import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import nunjucks from "nunjucks";
import { JSDOM } from "jsdom";

const noteSource = await readFile(
  new URL("../src/_includes/layouts/note.njk", import.meta.url), "utf8"
);
const start = noteSource.indexOf('<p class="note-save">');
const end = noteSource.indexOf("{%- if note.toc", start);
const noteTemplate = noteSource.slice(start, end);

test("renders one disabled, contextual save control from stable backend metadata", () => {
  const environment = new nunjucks.Environment(undefined, { autoescape: true });
  const title = `A&B "note"><img src=x>`;
  const document = new JSDOM(environment.renderString(noteTemplate, {
    title,
    note: { slug: "stable-note" },
  })).window.document;
  const button = document.querySelector("[data-reading-list-save]");
  assert.equal(document.querySelectorAll("[data-reading-list-save]").length, 1);
  assert.equal(button.dataset.readingListSave, "stable-note");
  assert.equal(button.type, "button");
  assert.equal(button.disabled, true);
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(button.getAttribute("aria-label"), `Save “${title}” for later`);
  assert.equal(document.querySelector("img"), null);
});

test("reading-list JSON exposes only public display metadata and is script-safe", async () => {
  const filters = new Map();
  const noop = () => {};
  const config = {
    addPassthroughCopy: noop,
    addFilter: (name, filter) => filters.set(name, filter),
    addTransform: noop,
  };
  const configure = (await import("../eleventy.config.js")).default;
  configure(config);
  const json = filters.get("readingListJson")([
    {
      slug: "safe",
      url: "/notes/safe.html",
      title: `Quotes & </script><script>unsafe()</script>`,
      category: "Security",
      content_html: "private body",
      tags: ["not-needed"],
    },
    { slug: "draft", url: "/draft", title: "Draft", published: false },
  ]);
  assert.equal(json.includes("</script>"), false);
  assert.deepEqual(JSON.parse(json), [{
    slug: "safe",
    url: "/notes/safe.html",
    title: `Quotes & </script><script>unsafe()</script>`,
    category: "Security",
  }]);
});
