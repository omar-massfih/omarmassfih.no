import assert from "node:assert/strict";
import test from "node:test";
import nunjucks from "nunjucks";
import { JSDOM } from "jsdom";

const environment = nunjucks.configure("src/_includes", { autoescape: true });
const render = (url) =>
  new JSDOM(environment.render("header.njk", { page: { url } })).window.document;

test("renders an accessible progressive-enhancement fallback", () => {
  const document = render("/");
  const nav = document.querySelector('nav[aria-label="Primary navigation"]');
  const toggle = document.querySelector("#header-menu-toggle");
  const panel = document.querySelector("#header-navigation-panel");

  assert.ok(document.querySelector(".header-identity"));
  assert.ok(nav);
  assert.equal(toggle.hidden, true);
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(toggle.getAttribute("aria-controls"), panel.id);
  assert.equal(panel.hidden, false);
  assert.deepEqual(
    [...panel.querySelectorAll("a")].map((link) => link.textContent.trim()),
    ["Projects", "Notes", "CV", "About"]
  );
  assert.ok(panel.querySelector("#site-search-trigger[hidden]"));
  assert.ok(panel.querySelector("#theme-toggle[hidden]"));
});

for (const [url, label] of [
  ["/", "Omar Massfih"],
  ["/index.html", "Omar Massfih"],
  ["/projects.html", "Projects"],
  ["/projects/omarmassfih-no.html", "Projects"],
  ["/notes.html", "Notes"],
  ["/notes/rag/retrieval.html", "Notes"],
  ["/notes/categories/kubernetes-k3s.html", "Notes"],
  ["/notes/projects/example.html", "Notes"],
  ["/cv.html", "CV"],
  ["/about.html", "About"],
]) {
  test(`marks ${url} as the single current destination`, () => {
    const current = [...render(url).querySelectorAll('[aria-current="page"]')];
    assert.equal(current.length, 1);
    assert.equal(current[0].textContent.trim(), label);
  });
}
