import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { JSDOM } from "jsdom";

const script = await readFile(new URL("../src/note-share.js", import.meta.url), "utf8");
const canonicalUrl = "https://example.test/notes/canonical.html";

function setup({ clipboard, share, markup } = {}) {
  const dom = new JSDOM(markup ?? `
    <link rel="canonical" href="${canonicalUrl}">
    <title>Window title that must not be shared</title>
    <section data-note-share data-share-title="Canonical note title">
      <button data-note-share-native type="button" aria-describedby="note-share-status" hidden>Share</button>
      <button data-note-share-copy type="button" aria-describedby="note-share-status" hidden>Copy link</button>
      <a data-original-email href="mailto:?subject=Static">Email</a>
      <p id="note-share-status" data-note-share-status role="status" aria-live="polite"></p>
    </section>`, { url: "https://wrong.test/current-page" });
  const timers = new Map();
  let nextTimer = 1;
  dom.window.setTimeout = (callback) => {
    const id = nextTimer++;
    timers.set(id, callback);
    return id;
  };
  dom.window.clearTimeout = (id) => timers.delete(id);

  const navigator = {};
  if (clipboard !== undefined) navigator.clipboard = clipboard;
  if (share !== undefined) navigator.share = share;
  runInNewContext(script, {
    document: dom.window.document,
    window: dom.window,
    navigator,
    Error,
  });

  return {
    dom,
    document: dom.window.document,
    flushTimers() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
    },
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("reveals supported actions and shares the exact canonical URL and note title", async () => {
  const shared = [];
  const { document } = setup({
    clipboard: { writeText: async () => {} },
    share: async (data) => shared.push(data),
  });
  const shareButton = document.querySelector("[data-note-share-native]");

  assert.equal(shareButton.hidden, false);
  assert.equal(document.querySelector("[data-note-share-copy]").hidden, false);
  shareButton.click();
  await settle();

  assert.equal(shared.length, 1);
  assert.equal(shared[0].title, "Canonical note title");
  assert.equal(shared[0].url, canonicalUrl);
  assert.equal(document.querySelector("[data-note-share-status]").textContent, "Note shared");
});

test("keeps native share hidden when unsupported and leaves static email untouched", () => {
  const { document } = setup({ clipboard: { writeText: async () => {} } });

  assert.equal(document.querySelector("[data-note-share-native]").hidden, true);
  assert.equal(document.querySelector("[data-original-email]").outerHTML,
    '<a data-original-email="" href="mailto:?subject=Static">Email</a>');
});

test("copies the exact canonical URL and resets visible polite feedback", async () => {
  const copied = [];
  const { document, flushTimers } = setup({
    clipboard: { writeText: async (value) => copied.push(value) },
  });
  const copyButton = document.querySelector("[data-note-share-copy]");
  const status = document.getElementById(copyButton.getAttribute("aria-describedby"));

  assert.equal(copyButton.tagName, "BUTTON");
  assert.equal(copyButton.type, "button");
  assert.equal(status.getAttribute("role"), "status");
  assert.equal(status.getAttribute("aria-live"), "polite");

  copyButton.click();
  await settle();
  assert.deepEqual(copied, [canonicalUrl]);
  assert.equal(status.textContent, "Link copied");
  assert.equal(status.dataset.state, "success");

  flushTimers();
  assert.equal(status.textContent, "");
  assert.equal(status.dataset.state, "");
});

test("reports rejected and unavailable clipboard access without unhandled rejection", async () => {
  for (const clipboard of [
    undefined,
    { writeText: async () => { throw new Error("denied"); } },
  ]) {
    const { document } = setup({ clipboard });
    document.querySelector("[data-note-share-copy]").click();
    await settle();
    const status = document.querySelector("[data-note-share-status]");
    assert.match(status.textContent, /Could not copy link/);
    assert.equal(status.dataset.state, "error");
  }
});

test("reports genuine share failures but treats AbortError as cancellation", async () => {
  for (const [error, expected] of [
    [Object.assign(new Error("failed"), { name: "NotAllowedError" }), /Could not share/],
    [Object.assign(new Error("cancelled"), { name: "AbortError" }), /^$/],
  ]) {
    const { document } = setup({
      share: async () => { throw error; },
    });
    document.querySelector("[data-note-share-native]").click();
    await settle();
    assert.match(document.querySelector("[data-note-share-status]").textContent, expected);
  }
});

test("initialization is idempotent, uses native click behavior, and ignores incomplete markup", async () => {
  let calls = 0;
  const { dom, document } = setup({
    clipboard: { writeText: async () => { calls += 1; } },
  });
  dom.window.enhanceNoteShare();
  document.querySelector("[data-note-share-copy]").dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true })
  );
  await settle();
  assert.equal(calls, 1);

  assert.doesNotThrow(() => setup({ markup: "<main class='note'></main>" }));
});
