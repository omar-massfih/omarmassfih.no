import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { JSDOM } from "jsdom";

const script = await readFile(new URL("../src/graph.js", import.meta.url), "utf8");
const graph = {
  nodes: [
    { id: "note:a", type: "note", label: "Alpha", category: "Systems", url: "/a.html" },
    { id: "note:b", type: "note", label: "Beta", category: "RAG", url: "/b.html" },
    { id: "tag:x", type: "tag", label: "x" },
  ],
  links: [
    { source: "note:a", target: "tag:x" },
    { source: "note:b", target: "tag:x" },
    { source: "note:a", target: "note:b", weight: 2 },
  ],
};

const setup = async ({ ok = true, reduced = true, root = "", graphData = graph } = {}) => {
  const dom = new JSDOM(`<section class="graph-section">
    <div class="knowledge-graph" data-graph-src="/graph.json" ${root ? `data-root-slug="${root}"` : ""}>
      <p class="graph-loading">Loading</p>
    </div>
    <aside><div data-graph-details><p>Instructions</p></div><p data-graph-status></p></aside>
    <details class="graph-fallback"><a href="/a.html">Alpha</a></details>
  </section>`, { url: "https://example.test/" });
  const { window } = dom;
  window.matchMedia = () => ({ matches: reduced });
  window.requestAnimationFrame = () => 1;
  window.SVGElement.prototype.getBoundingClientRect = () => ({
    left: 0, top: 0, width: 600, height: 400, right: 600, bottom: 400,
  });
  window.Element.prototype.setPointerCapture = () => {};
  const fetch = async () =>
    ok ? { ok: true, json: async () => structuredClone(graphData) } : { ok: false };
  runInNewContext(script, {
    window, document: window.document, fetch, requestAnimationFrame: window.requestAnimationFrame,
    setTimeout, structuredClone,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return dom;
};

test("enhances successfully, preserves fallback, and creates accessible controls", async () => {
  const { window } = await setup();
  assert(window.document.querySelector(".knowledge-graph svg"));
  assert(window.document.querySelector(".graph-fallback a"));
  const controls = [...window.document.querySelectorAll(".graph-controls button")];
  assert.deepEqual(controls.map((button) => button.getAttribute("aria-label")), ["Zoom in", "Zoom out", "Reset view"]);
  assert(controls.every((button) => button.type === "button"));
});

test("fetch failure leaves static fallback and instructions usable", async () => {
  const { window } = await setup({ ok: false });
  assert(!window.document.querySelector("svg"));
  assert.equal(window.document.querySelector(".graph-fallback a").href, "https://example.test/a.html");
  assert.match(window.document.querySelector("[data-graph-details]").textContent, /Instructions/);
  assert(!window.document.querySelector(".graph-loading"));
  assert.match(window.document.querySelector(".graph-unavailable").textContent, /Use the note links below/);
});

test("dragging a node suppresses the browser-generated click", async () => {
  const { window } = await setup();
  const note = window.document.querySelector('[data-id="note:b"]');
  note.dispatchEvent(new window.MouseEvent("pointerdown", {
    bubbles: true, button: 0, pointerId: 1, clientX: 10, clientY: 10,
  }));
  note.dispatchEvent(new window.MouseEvent("pointermove", {
    bubbles: true, pointerId: 1, clientX: 30, clientY: 30,
  }));
  note.dispatchEvent(new window.MouseEvent("pointerup", {
    bubbles: true, pointerId: 1, clientX: 30, clientY: 30,
  }));
  note.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  assert(!note.classList.contains("is-selected"));

  note.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert(note.classList.contains("is-selected"));
});

test("note and tag keyboard selection populate details without navigating", async () => {
  const { window } = await setup();
  const note = window.document.querySelector('[data-id="note:a"]');
  note.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert(note.classList.contains("is-selected"));
  assert.equal(note.getAttribute("aria-pressed"), "true");
  const noteDetails = window.document.querySelector("[data-graph-details]");
  assert.match(noteDetails.textContent, /Related notes:/);
  assert.equal(
    [...noteDetails.querySelectorAll("a")].find((link) => link.textContent === "Beta")?.getAttribute("href"),
    "/b.html"
  );
  assert.equal(
    [...noteDetails.querySelectorAll("a")].find((link) => link.textContent === "Open note")?.getAttribute("href"),
    "/a.html"
  );
  const tag = window.document.querySelector('[data-id="tag:x"]');
  tag.dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
  assert.match(window.document.querySelector("[data-graph-details]").textContent, /2 connected notes/);
});

test("tag activation details include notes revealed by expansion", async () => {
  const expandableGraph = {
    nodes: [
      ...graph.nodes,
      { id: "note:c", type: "note", label: "Gamma", category: "Systems", url: "/c.html" },
    ],
    links: [
      ...graph.links,
      { source: "note:c", target: "tag:x" },
    ],
  };
  const { window } = await setup({ root: "a", graphData: expandableGraph });
  window.document.querySelector('[data-id="tag:x"]').dispatchEvent(
    new window.MouseEvent("click", { bubbles: true })
  );

  const details = window.document.querySelector("[data-graph-details]");
  assert.match(details.textContent, /3 connected notes/);
  assert.deepEqual(
    [...details.querySelectorAll("a")].map((link) => link.textContent),
    ["Alpha", "Beta", "Gamma"]
  );
});

test("category events hide other categories and clear their selection", async () => {
  const { window } = await setup();
  window.document.querySelector('[data-id="note:b"]').dispatchEvent(
    new window.MouseEvent("click", { bubbles: true })
  );
  window.dispatchEvent(new window.CustomEvent("notes:categories-changed", {
    detail: { categories: ["Systems"], query: "ignored" },
  }));
  assert(window.document.querySelector('[data-id="note:b"]').classList.contains("is-filtered"));
  assert.match(window.document.querySelector("[data-graph-details]").textContent, /Select a note/);
});

test("tag details only list notes visible under the active category filter", async () => {
  const { window } = await setup();
  window.document.querySelector('[data-id="tag:x"]').dispatchEvent(
    new window.MouseEvent("click", { bubbles: true })
  );
  assert.match(window.document.querySelector("[data-graph-details]").textContent, /2 connected notes/);
  window.dispatchEvent(new window.CustomEvent("notes:categories-changed", {
    detail: { categories: ["Systems"], query: "" },
  }));
  const details = window.document.querySelector("[data-graph-details]");
  assert.match(details.textContent, /1 connected note/);
  assert.deepEqual(
    [...details.querySelectorAll("a")].map((link) => [link.textContent, link.getAttribute("href")]),
    [["Alpha", "/a.html"]]
  );
  assert.doesNotMatch(details.textContent, /Beta/);
});

test("local reduced-motion view initially selects its root", async () => {
  const { window } = await setup({ root: "a", reduced: true });
  assert(window.document.querySelector('[data-id="note:a"]').classList.contains("is-selected"));
  assert.match(window.document.querySelector("[data-graph-details]").textContent, /Alpha/);
});
