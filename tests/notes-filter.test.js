import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { JSDOM } from "jsdom";

const script = await readFile(new URL("../src/notes-filter.js", import.meta.url), "utf8");

const notes = [
  {
    url: "/notes/alpha/",
    title: "Alpha Clusters",
    description: "Managing reliable control planes",
    category: "Kubernetes",
    tags: ["cluster-api", "platform"],
  },
  {
    url: "/notes/beta/",
    title: "Beta Builds",
    description: "Release pipelines for applications",
    category: "OpenShift",
    tags: ["ci-cd", "builds"],
  },
  {
    url: "/notes/gamma/",
    title: "Gamma Storage",
    description: "Persistent volume operations",
    category: "Kubernetes",
    tags: ["storage"],
  },
];

const setup = () => {
  const dom = new JSDOM(`
    <nav class="notes-filter" aria-label="Filter notes" hidden>
      <label class="notes-search">
        <span class="visually-hidden">Search notes</span>
        <input type="search" class="notes-search-input" name="q">
      </label>
      <button type="button" class="tag tag-filter tag-filter-clear" data-clear aria-pressed="true">All</button>
      <button type="button" class="tag tag-filter" data-category="Kubernetes" aria-pressed="false">Kubernetes</button>
      <button type="button" class="tag tag-filter" data-category="OpenShift" aria-pressed="false">OpenShift</button>
    </nav>

    <section class="notes-list">
      <nav class="flex-container section-head notes-head">Kubernetes</nav>
      <a href="/notes/alpha/" class="list-row" data-category="Kubernetes">Alpha Clusters</a>
      <a href="/notes/gamma/" class="list-row" data-category="Kubernetes">Gamma Storage</a>
      <nav class="flex-container section-head notes-head">OpenShift</nav>
      <a href="/notes/beta/" class="list-row" data-category="OpenShift">Beta Builds</a>
      <p class="notes-empty" hidden>No notes match those filters.</p>
    </section>

    <script type="application/json" id="notes-search-data">${JSON.stringify(notes)}</script>
  `);
  const { document, Event, CustomEvent } = dom.window;

  runInNewContext(script, {
    document,
    window: dom.window,
    CustomEvent,
  });

  const rows = Array.from(document.querySelectorAll(".list-row"));
  const visibleRows = () => rows.filter((row) => !row.hidden).map((row) => row.getAttribute("href"));
  const search = (value) => {
    const input = document.querySelector(".notes-search-input");
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const clickCategory = (category) => {
    document.querySelector(`[data-category="${category}"]`).click();
  };

  return { document, window: dom.window, visibleRows, search, clickCategory };
};

test("filters by title", () => {
  const { document, visibleRows, search } = setup();

  search("alpha");

  assert.deepEqual(visibleRows(), ["/notes/alpha/"]);
  assert.equal(document.querySelector(".notes-empty").hidden, true);
});

test("filters by description", () => {
  const { visibleRows, search } = setup();

  search("release pipelines");

  assert.deepEqual(visibleRows(), ["/notes/beta/"]);
});

test("filters by category metadata", () => {
  const { visibleRows, search } = setup();

  search("kubernetes");

  assert.deepEqual(visibleRows(), ["/notes/alpha/", "/notes/gamma/"]);
});

test("filters by tags and de-hyphenated tags", () => {
  const { visibleRows, search } = setup();

  search("cluster api");

  assert.deepEqual(visibleRows(), ["/notes/alpha/"]);
});

test("combines category and search filters", () => {
  const { document, visibleRows, search, clickCategory } = setup();

  clickCategory("Kubernetes");
  search("release");

  assert.deepEqual(visibleRows(), []);
  assert.equal(document.querySelector(".notes-empty").hidden, false);

  search("control planes");
  assert.deepEqual(visibleRows(), ["/notes/alpha/"]);
  assert.equal(document.querySelector(".notes-empty").hidden, true);
});

test("All control is pressed only when no filters are active", () => {
  const { document, search, clickCategory } = setup();
  const clearButton = document.querySelector("[data-clear]");

  search("alpha");
  assert.equal(clearButton.getAttribute("aria-pressed"), "false");

  clickCategory("Kubernetes");
  assert.equal(clearButton.getAttribute("aria-pressed"), "false");

  clearButton.click();
  assert.equal(clearButton.getAttribute("aria-pressed"), "true");
});

test("category behavior and clear button still work", () => {
  const { document, visibleRows, clickCategory } = setup();
  const kubernetesButton = document.querySelector('[data-category="Kubernetes"]');
  const heads = Array.from(document.querySelectorAll(".notes-head"));

  clickCategory("OpenShift");

  assert.equal(document.querySelector('[data-category="OpenShift"]').getAttribute("aria-pressed"), "true");
  assert.deepEqual(visibleRows(), ["/notes/beta/"]);
  assert.equal(heads[0].hidden, true);
  assert.equal(heads[1].hidden, false);

  kubernetesButton.click();
  assert.equal(kubernetesButton.getAttribute("aria-pressed"), "true");
  assert.deepEqual(visibleRows(), ["/notes/alpha/", "/notes/gamma/", "/notes/beta/"]);

  document.querySelector("[data-clear]").click();
  assert.deepEqual(visibleRows(), ["/notes/alpha/", "/notes/gamma/", "/notes/beta/"]);
  assert.equal(kubernetesButton.getAttribute("aria-pressed"), "false");
  assert.equal(document.querySelector("[data-clear]").getAttribute("aria-pressed"), "true");
});

test("graph category event contract remains category-only", () => {
  const { window, search, clickCategory } = setup();
  const events = [];
  window.addEventListener("notes:categories-changed", (event) => {
    events.push(event.detail);
  });

  search("gamma");
  assert.deepEqual(events, []);
  assert.equal(window.notesCategoryFilter, undefined);

  clickCategory("OpenShift");
  search("alpha");

  assert.deepEqual(events.map((event) => Array.from(event.categories)), [["OpenShift"]]);
  assert.deepEqual(Array.from(window.notesCategoryFilter), ["OpenShift"]);
});

test("empty state is shown for no matches and hidden after clear", () => {
  const { document, search } = setup();

  search("not a real note");
  assert.equal(document.querySelector(".notes-empty").hidden, false);

  document.querySelector("[data-clear]").click();
  assert.equal(document.querySelector(".notes-search-input").value, "");
  assert.equal(document.querySelector(".notes-empty").hidden, true);
});
