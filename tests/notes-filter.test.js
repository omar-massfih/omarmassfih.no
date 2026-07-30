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
      <a href="/notes/categories/kubernetes.html" class="tag tag-filter" data-category="Kubernetes" aria-pressed="false">Kubernetes</a>
      <a href="/notes/categories/openshift.html" class="tag tag-filter" data-category="OpenShift" aria-pressed="false">OpenShift</a>
    </nav>

    <section class="notes-list">
      <nav class="flex-container section-head notes-head">Kubernetes</nav>
      <a href="/notes/alpha/" class="list-row" data-category="Kubernetes">
        <span class="list-row-main">
          <span class="list-row-title">Alpha Clusters</span>
          <span class="list-row-meta">2025-03-01 · 4 min read</span>
        </span>
        <p class="note-preview-description">Managing reliable control planes</p>
        <ul class="tag-list note-preview-tags" aria-label="Tags">
          <li class="tag">cluster-api</li>
          <li class="tag">platform</li>
        </ul>
      </a>
      <a href="/notes/gamma/" class="list-row" data-category="Kubernetes">
        <span class="list-row-main">
          <span class="list-row-title">Gamma Storage</span>
          <span class="list-row-meta">2025-01-01 · 3 min read</span>
        </span>
        <p class="note-preview-description">Persistent volume operations</p>
        <ul class="tag-list note-preview-tags" aria-label="Tags">
          <li class="tag">storage</li>
        </ul>
      </a>
      <nav class="flex-container section-head notes-head">OpenShift</nav>
      <a href="/notes/beta/" class="list-row" data-category="OpenShift">
        <span class="list-row-main">
          <span class="list-row-title">Beta Builds</span>
          <span class="list-row-meta">2025-02-01 · 5 min read</span>
        </span>
        <p class="note-preview-description">Release pipelines for applications</p>
        <ul class="tag-list note-preview-tags" aria-label="Tags">
          <li class="tag">ci-cd</li>
          <li class="tag">builds</li>
        </ul>
      </a>
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
  const { document, visibleRows, search } = setup();

  search("release pipelines");

  assert.deepEqual(visibleRows(), ["/notes/beta/"]);
  assert.equal(document.querySelector('[href="/notes/beta/"] .note-preview-description').textContent,
    "Release pipelines for applications");
});

test("filters by category metadata", () => {
  const { visibleRows, search } = setup();

  search("kubernetes");

  assert.deepEqual(visibleRows(), ["/notes/alpha/", "/notes/gamma/"]);
});

test("filters by tags and de-hyphenated tags", () => {
  const { document, visibleRows, search } = setup();

  search("cluster api");

  assert.deepEqual(visibleRows(), ["/notes/alpha/"]);
  assert.deepEqual(
    Array.from(document.querySelectorAll('[href="/notes/alpha/"] .note-preview-tags .tag'),
      (tag) => tag.textContent.trim()),
    ["cluster-api", "platform"]
  );
});

test("combines category and search filters", () => {
  const { document, visibleRows, search, clickCategory } = setup();

  clickCategory("Kubernetes");
  search("release");

  assert.deepEqual(visibleRows(), []);
  assert.equal(document.querySelector(".notes-empty").hidden, false);
  assert.equal(document.querySelectorAll(".notes-head:not([hidden])").length, 0);

  search("control planes");
  assert.deepEqual(visibleRows(), ["/notes/alpha/"]);
  assert.equal(document.querySelector(".notes-empty").hidden, true);
  assert.equal(document.querySelector('[href="/notes/alpha/"] .note-preview-description').hidden, false);
  assert.equal(document.querySelectorAll(".notes-head:not([hidden])").length, 1);
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

test("enhanced category links keep their destinations and intercept navigation", () => {
  const { document, visibleRows } = setup();
  const categoryLink = document.querySelector('[data-category="Kubernetes"]');
  const click = new document.defaultView.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
  });

  assert.equal(categoryLink.getAttribute("href"), "/notes/categories/kubernetes.html");
  assert.equal(categoryLink.dispatchEvent(click), false);
  assert.deepEqual(visibleRows(), ["/notes/alpha/", "/notes/gamma/"]);
});

test("category links preserve modified and non-primary click navigation", () => {
  for (const options of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
  ]) {
    const { document, visibleRows } = setup();
    const categoryLink = document.querySelector('[data-category="Kubernetes"]');
    const click = new document.defaultView.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ...options,
    });

    assert.equal(categoryLink.dispatchEvent(click), true);
    assert.equal(categoryLink.getAttribute("aria-pressed"), "false");
    assert.deepEqual(visibleRows(), ["/notes/alpha/", "/notes/gamma/", "/notes/beta/"]);
  }
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
  assert.equal(document.querySelectorAll(".list-row:not([hidden])").length, notes.length);
});
