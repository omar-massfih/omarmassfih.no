import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { JSDOM } from "jsdom";

const script = await readFile(new URL("../src/projects-filter.js", import.meta.url), "utf8");

const setup = (url = "https://example.test/projects.html") => {
  const dom = new JSDOM(`
    <form class="project-filter" hidden>
      <label for="technology">Technology</label>
      <select id="technology" name="technology">
        <option value="">All technologies</option>
        <option>Eleventy</option><option>Python</option>
      </select>
      <label for="source">Source</label>
      <select id="source" name="source">
        <option value="">All sources</option>
        <option>case study</option><option>github</option>
      </select>
      <button type="button" data-project-clear disabled>Clear filters</button>
      <p data-project-count aria-live="polite" aria-atomic="true"></p>
    </form>
    <div class="card-grid project-results" data-project-results>
      <article class="project-box" data-name="Alpha" data-source="github"
        data-technologies='["Python"]'></article>
      <article class="project-box" data-name="Beta" data-source="case study"
        data-technologies='["Eleventy"]'></article>
      <article class="project-box" data-name="Gamma" data-source="case study"
        data-technologies='["Python"]'></article>
    </div>
    <div data-project-empty hidden>
      <button type="button" data-project-clear>Clear filters</button>
    </div>
  `, { url });
  const { document, Event, PopStateEvent, URL, URLSearchParams } = dom.window;
  runInNewContext(script, {
    document,
    window: dom.window,
    URL,
    URLSearchParams,
  });

  const technology = document.querySelector('[name="technology"]');
  const source = document.querySelector('[name="source"]');
  const change = (select, value) => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const visible = () =>
    Array.from(document.querySelectorAll(".project-box:not([hidden])"), (card) => card.dataset.name);

  return { dom, document, technology, source, change, visible, PopStateEvent };
};

test("initializes with all projects visible and controls revealed", () => {
  const { document, visible } = setup();
  assert.deepEqual(visible(), ["Alpha", "Beta", "Gamma"]);
  assert.equal(document.querySelector(".project-filter").hidden, false);
  assert.equal(document.querySelector("[data-project-count]").textContent, "3 of 3 projects");
  assert.equal(document.querySelector("[data-project-empty]").hidden, true);
  assert.equal(document.querySelector("[data-project-clear]").disabled, true);
});

test("restores technology and source filters from the URL with AND semantics", () => {
  const technologyOnly = setup("https://example.test/projects.html?technology=Python");
  assert.equal(technologyOnly.technology.value, "Python");
  assert.deepEqual(technologyOnly.visible(), ["Alpha", "Gamma"]);

  const sourceOnly = setup("https://example.test/projects.html?source=case%20study");
  assert.deepEqual(sourceOnly.visible(), ["Beta", "Gamma"]);

  const combined = setup(
    "https://example.test/projects.html?technology=Eleventy&source=github"
  );
  assert.deepEqual(combined.visible(), []);
  assert.equal(combined.document.querySelector("[data-project-count]").textContent, "0 of 3 projects");
  assert.equal(combined.document.querySelector("[data-project-empty]").hidden, false);
});

test("changes update results, clear state, URL, and preserve unrelated state", () => {
  const { dom, document, technology, source, change, visible } = setup(
    "https://example.test/projects.html?campaign=summer#work"
  );
  change(technology, "Python");
  change(source, "case study");

  assert.deepEqual(visible(), ["Gamma"]);
  assert.equal(document.querySelector("[data-project-count]").textContent, "1 of 3 projects");
  assert.equal(document.querySelector("[data-project-clear]").disabled, false);
  assert.equal(dom.window.location.search, "?campaign=summer&technology=Python&source=case+study");
  assert.equal(dom.window.location.hash, "#work");

  document.querySelector("[data-project-clear]").click();
  assert.deepEqual(visible(), ["Alpha", "Beta", "Gamma"]);
  assert.equal(dom.window.location.search, "?campaign=summer");
  assert.equal(dom.window.location.hash, "#work");
});

test("unsupported URL values are ignored and canonicalized", () => {
  const { dom, technology, source, visible } = setup(
    "https://example.test/projects.html?technology=COBOL&source=unknown&keep=yes#projects"
  );
  assert.equal(technology.value, "");
  assert.equal(source.value, "");
  assert.deepEqual(visible(), ["Alpha", "Beta", "Gamma"]);
  assert.equal(dom.window.location.search, "?keep=yes");
  assert.equal(dom.window.location.hash, "#projects");
});

test("popstate restores controls and results", () => {
  const { dom, technology, change, visible, PopStateEvent } = setup();
  change(technology, "Python");
  assert.deepEqual(visible(), ["Alpha", "Gamma"]);

  dom.window.history.replaceState({}, "", "/projects.html?source=case%20study");
  dom.window.dispatchEvent(new PopStateEvent("popstate"));

  assert.equal(technology.value, "");
  assert.deepEqual(visible(), ["Beta", "Gamma"]);
});

test("filters all projects in place within the regular grid", () => {
  const { document, technology, source, change, visible } = setup();
  const grid = document.querySelector(".card-grid");
  const beta = [...grid.querySelectorAll(".project-box")]
    .find((card) => card.dataset.name === "Beta");
  const betaParent = beta.parentElement;

  change(technology, "Python");
  assert.equal(beta.hidden, true);
  assert.deepEqual(visible(), ["Alpha", "Gamma"]);
  assert.equal(beta.parentElement, betaParent);
  assert.equal(grid.contains(beta), true);

  change(technology, "");
  assert.equal(beta.hidden, false);
  change(source, "case study");
  assert.equal(beta.hidden, false);
  assert.deepEqual(visible(), ["Beta", "Gamma"]);
  assert.equal(beta.parentElement, betaParent);
  assert.equal(document.querySelector("[data-project-count]").textContent, "2 of 3 projects");
});

test("missing required DOM elements is a safe no-op", () => {
  const dom = new JSDOM("<main></main>", { url: "https://example.test/projects.html" });
  assert.doesNotThrow(() =>
    runInNewContext(script, {
      document: dom.window.document,
      window: dom.window,
      URL: dom.window.URL,
      URLSearchParams: dom.window.URLSearchParams,
    })
  );
});
