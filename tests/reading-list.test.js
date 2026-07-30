import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { JSDOM } from "jsdom";

const script = await readFile(new URL("../src/reading-list.js", import.meta.url), "utf8");
const notes = [
  { slug: "alpha", url: "/notes/alpha.html", title: "Alpha & one", category: "Ops" },
  { slug: "beta", url: "/notes/beta.html", title: "Beta", category: "Data" },
];

function markup() {
  return `
    <button data-reading-list-save="alpha" disabled aria-pressed="false">Save for later</button>
    <div data-reading-list-shell>
      <button data-reading-list-trigger hidden aria-expanded="false" aria-controls="reading-list-panel">Reading list <span data-reading-list-count>(0)</span></button>
      <p data-reading-list-unavailable hidden>Unavailable</p>
      <section id="reading-list-panel" data-reading-list-panel hidden>
        <button data-reading-list-close>Close</button>
        <p data-reading-list-empty>No saved notes yet.</p>
        <ol data-reading-list-items></ol>
      </section>
      <p data-reading-list-status role="status" aria-live="polite"></p>
    </div>
    <script type="application/json" id="reading-list-notes">${JSON.stringify(notes)}</script>`;
}

function setup({ initial, storage, html = markup() } = {}) {
  const dom = new JSDOM(html, { url: "https://example.test/" });
  if (initial !== undefined) dom.window.localStorage.setItem("reading-list:v1", initial);
  if (storage !== undefined) {
    Object.defineProperty(dom.window, "localStorage", { configurable: true, value: storage });
  }
  runInNewContext(script, {
    document: dom.window.document,
    window: dom.window,
    Error,
    Map,
    Set,
    JSON,
  });
  return { dom, document: dom.window.document, storage: storage || dom.window.localStorage };
}

test("initializes empty and progressively enables available controls", () => {
  const { document, storage } = setup();
  assert.equal(document.querySelector("[data-reading-list-trigger]").hidden, false);
  assert.equal(document.querySelector("[data-reading-list-save]").disabled, false);
  assert.equal(document.querySelector("[data-reading-list-empty]").hidden, false);
  assert.equal(document.querySelector("[data-reading-list-count]").textContent, "(0)");
  assert.equal(storage.getItem("reading-list:v1"), "[]");
});

test("saves idempotently, persists slugs, and reconstructs ordinary links", () => {
  const { document, storage } = setup();
  const save = document.querySelector("[data-reading-list-save]");
  save.click();
  assert.equal(storage.getItem("reading-list:v1"), '["alpha"]');
  assert.equal(save.getAttribute("aria-pressed"), "true");
  assert.equal(save.textContent, "Remove from reading list");
  assert.equal(save.getAttribute("aria-label"), "Remove “Alpha & one” from reading list");
  assert.match(document.querySelector("[data-reading-list-status]").textContent, /Saved “Alpha & one”/);
  const link = document.querySelector("[data-reading-list-items] a");
  assert.equal(link.textContent, "Alpha & one");
  assert.equal(link.getAttribute("href"), "/notes/alpha.html");

  const reloaded = setup({ initial: '["alpha","alpha"]' });
  assert.equal(reloaded.document.querySelectorAll("[data-reading-list-items] li").length, 1);
  assert.equal(reloaded.storage.getItem("reading-list:v1"), '["alpha"]');
});

test("removes from both the note control and panel", () => {
  const fromNote = setup({ initial: '["alpha"]' });
  fromNote.document.querySelector("[data-reading-list-save]").click();
  assert.equal(fromNote.storage.getItem("reading-list:v1"), "[]");

  const fromPanel = setup({ initial: '["alpha"]' });
  fromPanel.document.querySelector("[data-reading-list-remove]").click();
  assert.equal(fromPanel.storage.getItem("reading-list:v1"), "[]");
  assert.equal(fromPanel.document.querySelector("[data-reading-list-save]").getAttribute("aria-pressed"), "false");
});

test("keeps focus in a predictable position when removing panel items", () => {
  const { document } = setup({ initial: '["alpha","beta"]' });
  let removeButtons = document.querySelectorAll("[data-reading-list-remove]");
  removeButtons[0].focus();
  removeButtons[0].click();

  removeButtons = document.querySelectorAll("[data-reading-list-remove]");
  assert.equal(removeButtons[0].dataset.readingListRemove, "beta");
  assert.equal(document.activeElement, removeButtons[0]);

  removeButtons[0].click();
  assert.equal(document.activeElement, document.querySelector("[data-reading-list-close]"));

  const removingLast = setup({ initial: '["alpha","beta"]' }).document;
  removeButtons = removingLast.querySelectorAll("[data-reading-list-remove]");
  removeButtons[1].focus();
  removeButtons[1].click();
  assert.equal(
    removingLast.activeElement,
    removingLast.querySelector("[data-reading-list-remove]")
  );
});

test("normalizes malformed, wrong-shaped, duplicate, and obsolete stored values", () => {
  for (const initial of ["{broken", '{"alpha":true}', '["missing",2,"beta","beta"]']) {
    const { storage } = setup({ initial });
    assert.equal(storage.getItem("reading-list:v1"), initial.includes("beta") ? '["beta"]' : "[]");
  }
});

test("handles unavailable and write-failing storage without throwing", () => {
  const throwingStorage = {
    setItem() { throw new Error("blocked"); },
    getItem() { throw new Error("blocked"); },
    removeItem() {},
  };
  const { document } = setup({ storage: throwingStorage });
  assert.equal(document.querySelector("[data-reading-list-trigger]").hidden, true);
  assert.equal(document.querySelector("[data-reading-list-save]").disabled, true);
  assert.equal(document.querySelector("[data-reading-list-unavailable]").hidden, false);
  assert.match(document.querySelector("[data-reading-list-status]").textContent, /unavailable/);

  let writes = 0;
  const writeFailure = {
    value: null,
    setItem(key, value) {
      writes += 1;
      if (writes > 2) throw new Error("quota");
      this.value = value;
    },
    getItem() { return this.value; },
    removeItem() {},
  };
  const quota = setup({ storage: writeFailure });
  quota.document.querySelector("[data-reading-list-save]").click();
  assert.equal(quota.document.querySelector("[data-reading-list-save]").disabled, true);
  assert.equal(quota.document.querySelector("[data-reading-list-unavailable]").hidden, false);
});

test("moves focus to the availability message when a panel removal cannot be written", () => {
  let writes = 0;
  const values = new Map([["reading-list:v1", '["alpha"]']]);
  const writeFailure = {
    setItem(key, value) {
      writes += 1;
      if (writes > 2) throw new Error("quota");
      values.set(key, value);
    },
    getItem(key) { return values.get(key) || null; },
    removeItem(key) { values.delete(key); },
  };
  const { document } = setup({ storage: writeFailure });
  document.querySelector("[data-reading-list-trigger]").click();
  const remove = document.querySelector("[data-reading-list-remove]");
  remove.focus();
  remove.click();

  const unavailable = document.querySelector("[data-reading-list-unavailable]");
  assert.equal(document.querySelector("[data-reading-list-panel]").hidden, true);
  assert.equal(unavailable.hidden, false);
  assert.equal(document.activeElement, unavailable);
});

test("synchronizes tabs and supports panel focus restoration and Escape", () => {
  const { dom, document } = setup();
  const trigger = document.querySelector("[data-reading-list-trigger]");
  trigger.focus();
  trigger.click();
  assert.equal(document.querySelector("[data-reading-list-panel]").hidden, false);
  assert.equal(document.activeElement, document.querySelector("[data-reading-list-close]"));

  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(document.querySelector("[data-reading-list-panel]").hidden, true);
  assert.equal(document.activeElement, trigger);

  dom.window.dispatchEvent(new dom.window.StorageEvent("storage", {
    key: "reading-list:v1",
    newValue: '["beta","missing"]',
  }));
  assert.equal(document.querySelector("[data-reading-list-items] a").textContent, "Beta");
  assert.match(document.querySelector("[data-reading-list-status]").textContent, /another tab/);
});

test("clears the rendered reading list when another tab clears storage", () => {
  const { dom, document } = setup({ initial: '["alpha","beta"]' });

  dom.window.dispatchEvent(new dom.window.StorageEvent("storage", {
    key: null,
    newValue: null,
  }));

  assert.equal(document.querySelectorAll("[data-reading-list-items] li").length, 0);
  assert.equal(document.querySelector("[data-reading-list-empty]").hidden, false);
  assert.equal(document.querySelector("[data-reading-list-count]").textContent, "(0)");
  assert.equal(document.querySelector("[data-reading-list-save]").getAttribute("aria-pressed"), "false");
});

test("preserves predictable panel focus while synchronizing tabs", () => {
  const stillSaved = setup({ initial: '["alpha","beta"]' });
  let removeButtons = stillSaved.document.querySelectorAll("[data-reading-list-remove]");
  removeButtons[1].focus();
  stillSaved.dom.window.dispatchEvent(new stillSaved.dom.window.StorageEvent("storage", {
    key: "reading-list:v1",
    newValue: '["beta","alpha"]',
  }));
  assert.equal(
    stillSaved.document.activeElement.dataset.readingListRemove,
    "beta"
  );

  const removed = setup({ initial: '["alpha","beta"]' });
  removeButtons = removed.document.querySelectorAll("[data-reading-list-remove]");
  removeButtons[0].focus();
  removed.dom.window.dispatchEvent(new removed.dom.window.StorageEvent("storage", {
    key: "reading-list:v1",
    newValue: '["beta"]',
  }));
  assert.equal(removed.document.activeElement.dataset.readingListRemove, "beta");

  removed.dom.window.dispatchEvent(new removed.dom.window.StorageEvent("storage", {
    key: null,
    newValue: null,
  }));
  assert.equal(
    removed.document.activeElement,
    removed.document.querySelector("[data-reading-list-close]")
  );
});

test("ignores incomplete markup without throwing", () => {
  assert.doesNotThrow(() => setup({ html: "<main>Static content</main>" }));
});
