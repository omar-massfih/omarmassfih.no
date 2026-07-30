import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { JSDOM } from "jsdom";

const script = await readFile(
  new URL("../src/note-reading-progress.js", import.meta.url),
  "utf8"
);

const markup = `
  <nav class="note-toc">
    <div data-note-reading-progress hidden>
      <progress data-note-reading-progress-value max="100" value="0">0%</progress>
      <span data-note-reading-progress-text>0%</span>
    </div>
    <a data-note-toc-link href="#first">First</a>
    <a data-note-toc-link href="#detail">Detail</a>
    <a data-note-toc-link href="#part%23three">Third</a>
  </nav>
  <div data-note-content>
    <h2 id="first">First</h2>
    <h3 id="detail">Detail</h3>
    <h2 id="part#three">Third</h2>
  </div>`;

function setup(html = markup) {
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const frames = [];
  let contentRect = { top: 800, height: 1000 };
  const headingTops = { first: 100, detail: 500, "part#three": 900 };
  const listenerCounts = { scroll: 0, resize: 0 };
  const nativeAddEventListener = dom.window.addEventListener.bind(dom.window);

  Object.defineProperty(dom.window, "innerHeight", { value: 600, writable: true });
  dom.window.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  dom.window.addEventListener = (type, listener, options) => {
    if (type in listenerCounts) listenerCounts[type] += 1;
    nativeAddEventListener(type, listener, options);
  };

  const content = document.querySelector("[data-note-content]");
  if (content) content.getBoundingClientRect = () => ({ ...contentRect });
  for (const [id, top] of Object.entries(headingTops)) {
    const heading = document.getElementById(id);
    if (heading) heading.getBoundingClientRect = () => ({ top: headingTops[id] });
  }

  runInNewContext(script, {
    document,
    window: dom.window,
    decodeURIComponent,
  });

  return {
    dom,
    document,
    frames,
    headingTops,
    listenerCounts,
    setContentRect(rect) {
      contentRect = rect;
    },
    flushFrame() {
      frames.shift()?.();
    },
  };
}

test("reveals and initializes the semantic progress UI", () => {
  const { document } = setup();
  const container = document.querySelector("[data-note-reading-progress]");

  assert.equal(container.hidden, false);
  assert.equal(document.querySelector("progress").value, 0);
  assert.equal(document.querySelector("[data-note-reading-progress-text]").textContent, "0%");
});

test("exits safely when required note markup or usable headings are absent", () => {
  assert.doesNotThrow(() => setup("<div data-note-content></div>"));
  const { document } = setup(`
    <nav class="note-toc">
      <div data-note-reading-progress hidden>
        <progress data-note-reading-progress-value max="100" value="0"></progress>
        <span data-note-reading-progress-text>0%</span>
      </div>
      <a data-note-toc-link href="#missing">Missing</a>
    </nav>
    <div data-note-content></div>`);

  assert.equal(document.querySelector("[data-note-reading-progress]").hidden, true);
});

test("initialization is idempotent", () => {
  const { dom, listenerCounts } = setup();

  dom.window.enhanceNoteReadingProgress();
  assert.deepEqual(listenerCounts, { scroll: 1, resize: 1 });
});

test("clamps progress and updates both progress representations", () => {
  const setupResult = setup();
  const { document, dom } = setupResult;
  const progress = document.querySelector("progress");
  const text = document.querySelector("[data-note-reading-progress-text]");

  setupResult.setContentRect({ top: 100, height: 1000 });
  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  setupResult.flushFrame();
  assert.equal(progress.value, 50);
  assert.equal(text.textContent, "50%");

  setupResult.setContentRect({ top: -500, height: 1000 });
  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  setupResult.flushFrame();
  assert.equal(progress.value, 100);

  setupResult.setContentRect({ top: 900, height: 1000 });
  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  setupResult.flushFrame();
  assert.equal(progress.value, 0);
});

test("marks one current section and keeps the final heading current", () => {
  const setupResult = setup();
  const { document, dom, headingTops } = setupResult;
  const links = [...document.querySelectorAll("[data-note-toc-link]")];

  assert.equal(document.querySelector("[aria-current]"), null);

  headingTops.first = 40;
  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  setupResult.flushFrame();
  assert.equal(links[0].getAttribute("aria-current"), "location");

  headingTops.detail = 48;
  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  setupResult.flushFrame();
  assert.equal(document.querySelectorAll('[aria-current="location"]').length, 1);
  assert.equal(links[0].classList.contains("is-current"), false);
  assert.equal(links[1].classList.contains("is-current"), true);

  headingTops["part#three"] = -100;
  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  setupResult.flushFrame();
  assert.equal(links[2].getAttribute("aria-current"), "location");
  assert.equal(document.querySelectorAll(".is-current").length, 1);
});

test("coalesces scroll updates and recalculates on resize", () => {
  const setupResult = setup();
  const { dom, frames } = setupResult;

  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  assert.equal(frames.length, 1);
  setupResult.flushFrame();

  dom.window.innerHeight = 800;
  setupResult.setContentRect({ top: 300, height: 1000 });
  dom.window.dispatchEvent(new dom.window.Event("resize"));
  setupResult.flushFrame();
  assert.equal(setupResult.document.querySelector("progress").value, 50);
});

test("leaves native fragment links and click behavior intact", () => {
  const { document, dom } = setup();
  const link = document.querySelector("[data-note-toc-link]");
  const event = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true });

  link.dispatchEvent(event);
  assert.equal(link.getAttribute("href"), "#first");
  assert.equal(event.defaultPrevented, false);
});
