import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const books = JSON.parse(fs.readFileSync("src/_data/bookReviews.json", "utf8"));
const document = new JSDOM(fs.readFileSync("_site/books/index.html", "utf8")).window.document;
assert.equal(document.querySelector('link[rel="canonical"]').href, "https://omarmassfih.no/books/");
assert.equal(document.querySelector('[aria-current="page"]').textContent, "Books");
assert.equal(document.querySelectorAll(".book-card").length, books.length);
assert.deepEqual(
  [...document.querySelectorAll(".book-card")].map(({ id }) => id),
  books.map(({ slug }) => slug).reverse(),
  "Books must appear from newest added to oldest"
);
for (const book of books) {
  const card = document.getElementById(book.slug);
  assert.ok(card, `Missing ${book.title}`);
  assert.equal(card.querySelector("h2").textContent, book.title);
  assert.equal(card.querySelector(".book-author").textContent, book.author);
  assert.equal(card.querySelector(".book-review").textContent, book.review);
  assert.equal(card.querySelector("a").href, book.url);
  const cover = card.querySelector(".book-cover");
  if (book.cover) {
    assert.ok(cover, `Missing cover for ${book.title}`);
    assert.equal(cover.getAttribute("src"), book.cover);
    assert.ok(fs.statSync(`_site${book.cover}`).size > 0, `Missing cover asset for ${book.title}`);
    assert.equal(cover.getAttribute("alt"), "");
    assert.equal(cover.getAttribute("loading"), "lazy");
    assert.ok(cover.hasAttribute("width") && cover.hasAttribute("height"));
  }
  assert.equal(card.dataset.rating, String(book.rating || "unrated"));
  assert.equal(card.hidden, false, "Books must remain visible without JavaScript");
  if (book.rating) assert.equal(card.querySelector(".book-rating").getAttribute("aria-label"), `${book.rating} out of 5 stars`);
}
if (books.length) {
  assert.ok(document.querySelector('.book-filters[hidden][aria-label="Filter books"]'));
  assert.ok(document.querySelector('script[src^="/books-filter.js?v="][defer]'));
  assert.ok(fs.existsSync("_site/books-filter.js"));
}
const sitemap = new JSDOM(fs.readFileSync("_site/sitemap.xml", "utf8"), { contentType: "text/xml" }).window.document;
assert.ok([...sitemap.querySelectorAll("loc")].some(({ textContent }) => textContent === "https://omarmassfih.no/books/"));
console.log(`Verified ${books.length} book cards, ratings, progressive filters, and sitemap entry.`);
