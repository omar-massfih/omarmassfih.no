import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { JSDOM } from "jsdom";

const script = await readFile(new URL("../src/site-search.js", import.meta.url), "utf8");
const data = [
  { type: "note", title: "Platform Notes", url: "/notes/platform/", summary: "Exact", searchText: "platform notes kubernetes" },
  { type: "note", title: "A Platform Guide", url: "/notes/guide/", summary: "Contains", searchText: "a platform guide" },
  { type: "project", title: "Platform", url: "https://example.com/project", summary: "Project", searchText: "platform gitops" },
  { type: "skill", title: "Kubernetes", url: "/cv.html#skills", summary: "Cloud", searchText: "kubernetes cloud platform" },
];

const markup = `
  <button id="site-search-trigger" hidden>Search</button>
  <dialog id="site-search-dialog" aria-labelledby="site-search-title">
    <h2 id="site-search-title">Search this site</h2>
    <button class="site-search-close">Close</button>
    <input id="site-search-input">
    <p id="site-search-status" aria-live="polite" aria-atomic="true"></p>
    <div id="site-search-results"></div>
  </dialog>`;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = ({ failFirst = false } = {}) => {
  const dom = new JSDOM(markup, { url: "https://site.test/" });
  const { document, Event, KeyboardEvent } = dom.window;
  const dialog = document.querySelector("dialog");
  dialog.showModal = () => dialog.setAttribute("open", "");
  dialog.close = () => {
    dialog.removeAttribute("open");
    dialog.dispatchEvent(new Event("close"));
  };
  let calls = 0;
  const fetch = async () => {
    calls += 1;
    if (failFirst && calls === 1) throw new Error("offline");
    return { ok: true, json: async () => data };
  };
  runInNewContext(script, { document, window: dom.window, fetch });
  return {
    dom, document, Event, KeyboardEvent,
    calls: () => calls,
    trigger: document.getElementById("site-search-trigger"),
    input: document.getElementById("site-search-input"),
    status: document.getElementById("site-search-status"),
  };
};

test("reveals the trigger and lazily loads the index only once", async () => {
  const view = setup();
  assert.equal(view.trigger.hidden, false);
  assert.equal(view.calls(), 0);
  view.trigger.click();
  await tick();
  assert.equal(view.calls(), 1);
  assert.equal(view.document.activeElement, view.input);
  view.document.querySelector(".site-search-close").click();
  view.trigger.click();
  await tick();
  assert.equal(view.calls(), 1);
});

test("opens with Ctrl+K, groups matches, and applies relevance order", async () => {
  const view = setup();
  view.document.dispatchEvent(new view.KeyboardEvent("keydown", {
    key: "k", ctrlKey: true, bubbles: true, cancelable: true,
  }));
  await tick();
  view.input.value = "platform";
  view.input.dispatchEvent(new view.Event("input", { bubbles: true }));

  assert.deepEqual(
    [...view.document.querySelectorAll(".site-search-group h3")].map((node) => node.textContent),
    ["Notes", "Projects", "Skills"]
  );
  assert.deepEqual(
    [...view.document.querySelectorAll(".site-search-result-title")].map((node) => node.textContent),
    ["Platform Notes", "A Platform Guide", "Platform", "Kubernetes"]
  );
  assert.match(view.status.textContent, /4 results/);
});

test("announces short and no-match queries and inserts result text safely", async () => {
  data.push({ type: "note", title: "<img src=x>", url: "/safe", summary: "<b>text</b>", searchText: "unsafe" });
  const view = setup();
  view.trigger.click();
  await tick();
  assert.match(view.status.textContent, /at least two/);
  view.input.value = "missing";
  view.input.dispatchEvent(new view.Event("input"));
  assert.match(view.status.textContent, /No results/);
  view.input.value = "unsafe";
  view.input.dispatchEvent(new view.Event("input"));
  assert.equal(view.document.querySelector(".site-search-result-title").textContent, "<img src=x>");
  assert.equal(view.document.querySelector(".site-search-result img"), null);
  data.pop();
});

test("supports result navigation and Escape focus restoration", async () => {
  const view = setup();
  view.trigger.click();
  await tick();
  view.input.value = "platform";
  view.input.dispatchEvent(new view.Event("input"));
  const key = (value) => view.input.dispatchEvent(new view.KeyboardEvent("keydown", {
    key: value, bubbles: true, cancelable: true,
  }));
  key("ArrowDown");
  assert.equal(view.input.getAttribute("aria-activedescendant"), "site-search-result-0");
  key("End");
  assert.equal(view.document.querySelector('[aria-selected="true"]').id, "site-search-result-3");
  key("Home");
  assert.equal(view.document.querySelector('[aria-selected="true"]').id, "site-search-result-0");
  key("Escape");
  assert.equal(view.document.querySelector("dialog").hasAttribute("open"), false);
  assert.equal(view.document.activeElement, view.trigger);
});

test("Enter activates the selected result and preserves internal and external URLs", async () => {
  const view = setup();
  view.trigger.click();
  await tick();
  view.input.value = "platform";
  view.input.dispatchEvent(new view.Event("input"));
  const links = [...view.document.querySelectorAll(".site-search-result")];
  assert.equal(links[0].getAttribute("href"), "/notes/platform/");
  assert.equal(links[2].getAttribute("href"), "https://example.com/project");
  let activated = "";
  links[0].addEventListener("click", (event) => {
    event.preventDefault();
    activated = event.currentTarget.getAttribute("href");
  });
  view.input.dispatchEvent(new view.KeyboardEvent("keydown", { key: "ArrowDown" }));
  view.input.dispatchEvent(new view.KeyboardEvent("keydown", {
    key: "Enter", bubbles: true, cancelable: true,
  }));
  assert.equal(activated, "/notes/platform/");
  assert.equal(view.document.querySelector("dialog").hasAttribute("open"), false);
});

test("announces a fetch failure and retries on a later open", async () => {
  const view = setup({ failFirst: true });
  view.trigger.click();
  await tick();
  assert.match(view.status.textContent, /could not be loaded/);
  view.document.querySelector(".site-search-close").click();
  view.trigger.click();
  await tick();
  assert.equal(view.calls(), 2);
  assert.match(view.status.textContent, /at least two/);
});
