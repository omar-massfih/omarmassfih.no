import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import nunjucks from "nunjucks";
import { JSDOM } from "jsdom";
import buildBookshelf from "../lib/bookReviews.js";
import buildSiteSearchIndex from "../lib/siteSearchIndex.js";

const source = await readFile(new URL("../src/books.html", import.meta.url), "utf8");
const template = source.replace(/^---[\s\S]*?---/, "");
const script = await readFile(new URL("../src/books-filter.js", import.meta.url), "utf8");
const environment = new nunjucks.Environment();
environment.addFilter("bookshelf", buildBookshelf);
environment.addFilter("assetHash", () => "fixturehash");
const fixtures = [
  { slug: "teams", title: "Teams <work>", author: "A & B", genre: "Teams", cover: "/bilder/books/teams.webp", rating: 3, review: "Too much <fluff>.", url: "https://example.test/teams" },
  { slug: "data", title: "Data", author: "C", genre: "Data", rating: 5, review: "Excellent.", url: "https://example.test/data" },
  { slug: "more-data", title: "More data", author: "D", genre: "Data", rating: 3, review: "Useful.", url: "https://example.test/more-data" },
  { slug: "unrated", title: "Unrated", author: "E", genre: "Data", rating: null, review: "No rating yet.", url: "https://example.test/unrated" },
];
const render = (books = fixtures) => environment.renderString(template, { bookReviews: books });
const setup = () => {
  const dom = new JSDOM(render(), { url: "https://site.test/books/" });
  runInNewContext(script, { document: dom.window.document, window: dom.window, queueMicrotask });
  const document = dom.window.document;
  return {
    dom, document,
    genre: document.querySelector('[name="genre"]'),
    rating: document.querySelector('[name="rating"]'),
    reset: document.querySelector("[data-book-clear]"),
    visible: () => [...document.querySelectorAll(".book-card:not([hidden])")].map(({ id }) => id),
    change(select, value) {
      select.value = value;
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    },
  };
};

test("book cards preserve authored order, escaped text, and accessible star ratings without JavaScript", () => {
  const document = new JSDOM(render()).window.document;
  const cards = [...document.querySelectorAll(".book-card")];
  assert.deepEqual(cards.map(({ id }) => id), fixtures.map(({ slug }) => slug));
  assert.equal(document.querySelector(".book-filters").hidden, true);
  for (const [i, card] of cards.entries()) {
    assert.equal(card.hidden, false);
    assert.equal(card.querySelector("h2").textContent, fixtures[i].title);
    assert.equal(card.querySelector(".book-review").textContent, fixtures[i].review);
    assert.equal(card.querySelector("a").href, fixtures[i].url);
    const cover = card.querySelector(".book-cover");
    if (fixtures[i].cover) {
      assert.equal(cover.getAttribute("src"), fixtures[i].cover);
      assert.equal(cover.getAttribute("alt"), "");
      assert.equal(cover.getAttribute("loading"), "lazy");
      assert.equal(cover.getAttribute("width"), "144");
      assert.equal(cover.getAttribute("height"), "216");
    } else {
      assert.equal(cover, null);
      assert.equal(card.querySelector(".book-card-heading--with-cover"), null);
    }
    if (fixtures[i].rating) {
      assert.equal(card.querySelector('[role="img"]').getAttribute("aria-label"), `${fixtures[i].rating} out of 5 stars`);
      assert.equal(card.querySelectorAll(".book-rating span[aria-hidden] > span:not(.book-star-empty)").length, fixtures[i].rating);
    }
  }
  assert.equal(document.querySelector("fluff, work"), null);
  assert.equal(cards[3].querySelector(".book-rating"), null);
  assert.equal(cards[3].querySelector(".book-unrated").textContent, "Not rated yet");
  assert.deepEqual([...document.querySelector('[name="genre"]').options].map(({ value }) => value), ["", "Data", "Teams"]);
});

test("genre and rating filters intersect, announce counts, and reset both controls", () => {
  const view = setup();
  assert.equal(view.document.querySelector(".book-filters").hidden, false);
  view.change(view.genre, "Data");
  assert.deepEqual(view.visible(), ["data", "more-data", "unrated"]);
  view.change(view.rating, "3");
  assert.deepEqual(view.visible(), ["more-data"]);
  assert.equal(view.document.querySelector('[role="status"]').textContent, "1 of 4 books");
  assert.equal(view.reset.disabled, false);
  view.reset.click();
  assert.deepEqual(view.visible(), fixtures.map(({ slug }) => slug));
  assert.equal(view.genre.value, "");
  assert.equal(view.rating.value, "");
  assert.equal(view.reset.disabled, true);
  view.dom.window.close();
});

test("empty combinations recover and unrated books can be selected explicitly", () => {
  const view = setup();
  view.change(view.genre, "Teams");
  view.change(view.rating, "5");
  assert.deepEqual(view.visible(), []);
  assert.equal(view.document.querySelector("[data-book-empty]").hidden, false);
  view.change(view.rating, "3");
  assert.deepEqual(view.visible(), ["teams"]);
  assert.equal(view.document.querySelector("[data-book-empty]").hidden, true);
  view.change(view.genre, "");
  view.change(view.rating, "unrated");
  assert.deepEqual(view.visible(), ["unrated"]);
  view.dom.window.close();
});

test("returning to the page resynchronizes restored filter values", () => {
  const view = setup();
  view.rating.value = "5";
  view.dom.window.dispatchEvent(new view.dom.window.Event("pageshow"));
  assert.deepEqual(view.visible(), ["data"]);
  view.dom.window.close();
});

test("direct book links reveal a filtered-out card so search results stay usable", () => {
  const view = setup();
  view.change(view.genre, "Teams");
  const target = view.document.getElementById("data");
  let scrolled = false;
  target.scrollIntoView = () => { scrolled = true; };
  view.dom.window.history.replaceState({}, "", "/books/#data");
  view.dom.window.dispatchEvent(new view.dom.window.Event("hashchange"));
  assert.equal(target.hidden, false);
  assert.equal(view.genre.value, "");
  assert.equal(scrolled, true);
  view.dom.window.close();
});

test("a shelf without reviews has a plain empty state and no unusable filters or script", () => {
  const document = new JSDOM(render([])).window.document;
  assert.equal(document.querySelector(".book-filters, .book-card, script"), null);
  assert.equal(document.querySelector(".books-empty").textContent, "No book reviews yet.");
});

test("duplicate anchors and invalid star ratings fail clearly before publishing", () => {
  assert.throws(() => buildBookshelf([fixtures[0], fixtures[0]]), /unique URL-safe slugs/);
  for (const rating of [0, 6, 2.5, "3"]) {
    assert.throws(() => buildBookshelf([{ ...fixtures[0], rating }]), /integer from 1 to 5/);
  }
});

test("site search finds books by author, genre, and review and links to their cards", () => {
  const records = buildSiteSearchIndex([], [], {}, fixtures).filter(({ type }) => type === "book");
  assert.equal(records[0].url, "/books/");
  assert.equal(records.length, fixtures.length + 1);
  assert.equal(records[1].url, "/books/#teams");
  assert.match(records[1].searchText, /a & b teams/);
  assert.match(records[2].searchText, /excellent/);
});
