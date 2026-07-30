import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { JSDOM } from "jsdom";

const script = await readFile(new URL("../src/header-navigation.js", import.meta.url), "utf8");
const stylesheet = await readFile(new URL("../src/style.css", import.meta.url), "utf8");
const markup = `
  <button id="header-menu-toggle" hidden aria-expanded="false"
    aria-controls="header-navigation-panel" aria-label="Open navigation menu">Menu</button>
  <div id="header-navigation-panel">
    <a href="/projects.html">Projects</a>
    <a href="/notes.html">Notes</a>
    <button id="site-search-trigger">Search</button>
    <button id="theme-toggle">Theme</button>
  </div>
  <dialog id="site-search-dialog"></dialog>`;

const setup = ({ matches = true, html = markup } = {}) => {
  const dom = new JSDOM(html, { url: "https://site.test/" });
  const listeners = [];
  const query = {
    matches,
    addEventListener: (type, listener) => {
      if (type === "change") listeners.push(listener);
    },
  };
  dom.window.matchMedia = () => query;
  runInNewContext(script, { document: dom.window.document, window: dom.window });
  return {
    dom,
    document: dom.window.document,
    toggle: dom.window.document.getElementById("header-menu-toggle"),
    panel: dom.window.document.getElementById("header-navigation-panel"),
    setMobile(value) {
      query.matches = value;
      for (const listener of listeners) listener({ matches: value });
    },
  };
};

test("mobile initialization reveals the toggle and collapses the fallback panel", () => {
  const view = setup();
  assert.equal(view.toggle.hidden, false);
  assert.equal(view.panel.hidden, true);
  assert.equal(view.toggle.getAttribute("aria-expanded"), "false");
});

test("enhanced mobile styles keep the hidden panel out of layout", () => {
  assert.match(
    stylesheet,
    /\.header-navigation--enhanced\s+\.header-navigation-panel\[hidden\]\s*\{[^}]*display:\s*none\s*;/s
  );
});

test("toggle synchronizes state and moves focus into the opened panel", () => {
  const view = setup();
  view.toggle.click();
  assert.equal(view.panel.hidden, false);
  assert.equal(view.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(view.toggle.getAttribute("aria-label"), "Close navigation menu");
  assert.equal(view.document.activeElement, view.panel.querySelector("a"));
  view.toggle.click();
  assert.equal(view.panel.hidden, true);
  assert.equal(view.toggle.getAttribute("aria-label"), "Open navigation menu");
});

test("Escape closes an open mobile menu and restores toggle focus", () => {
  const view = setup();
  view.toggle.click();
  view.document.dispatchEvent(new view.dom.window.KeyboardEvent("keydown", {
    key: "Escape", bubbles: true,
  }));
  assert.equal(view.panel.hidden, true);
  assert.equal(view.document.activeElement, view.toggle);
});

test("navigation and search activation close the mobile panel", () => {
  for (const selector of ["a", "#site-search-trigger"]) {
    const view = setup();
    view.toggle.click();
    const target = view.panel.querySelector(selector);
    target.addEventListener("click", (event) => event.preventDefault());
    target.dispatchEvent(new view.dom.window.MouseEvent("click", {
      bubbles: true, cancelable: true,
    }));
    assert.equal(view.panel.hidden, true);
  }
});

test("closing search restores focus to the visible mobile menu toggle", () => {
  const view = setup();
  view.toggle.click();
  view.document.getElementById("site-search-trigger").click();
  view.document.getElementById("site-search-dialog").dispatchEvent(
    new view.dom.window.Event("close")
  );
  assert.equal(view.document.activeElement, view.toggle);
});

test("desktop remains exposed and breakpoint changes normalize state", () => {
  const view = setup({ matches: false });
  assert.equal(view.toggle.hidden, true);
  assert.equal(view.panel.hidden, false);
  view.setMobile(true);
  assert.equal(view.toggle.hidden, false);
  assert.equal(view.panel.hidden, true);
  view.toggle.click();
  view.setMobile(false);
  assert.equal(view.toggle.hidden, true);
  assert.equal(view.panel.hidden, false);
  assert.equal(view.toggle.getAttribute("aria-expanded"), "false");
});

test("switching to mobile moves panel focus to the revealed toggle", () => {
  const view = setup({ matches: false });
  view.document.getElementById("theme-toggle").focus();
  assert.equal(view.panel.contains(view.document.activeElement), true);
  view.setMobile(true);
  assert.equal(view.panel.hidden, true);
  assert.equal(view.document.activeElement, view.toggle);
});

test("missing markup is a safe no-op", () => {
  assert.doesNotThrow(() => setup({ html: "<main>Content</main>" }));
});

test("ordinary Tab is not intercepted", () => {
  const view = setup();
  view.toggle.click();
  const event = new view.dom.window.KeyboardEvent("keydown", {
    key: "Tab", bubbles: true, cancelable: true,
  });
  view.document.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(view.panel.hidden, false);
});
