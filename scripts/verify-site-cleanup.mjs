import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const siteDir = path.resolve("_site");
const origin = "https://omarmassfih.no";
const files = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? files(file) : [file];
});
const outputFile = (url) => path.join(siteDir, decodeURIComponent(url.pathname), url.pathname.endsWith("/") ? "index.html" : "");
const checkUrl = (value, base) => {
  const url = new URL(value, base);
  if (url.origin !== origin) return;
  assert.ok(url.pathname === "/404.html" || !url.pathname.endsWith(".html"), `${base}: old HTML link ${value}`);
  assert.ok(fs.statSync(outputFile(url)).isFile(), `${base}: missing destination ${value}`);
};

for (const route of ["", "projects/", "notes/", "cv/", "about/"]) {
  assert.ok(fs.existsSync(path.join(siteDir, route, "index.html")), `Missing /${route}`);
}
for (const retired of ["skills", "learning-paths", "om", "prosjekter", "projects/omarmassfih-no"]) {
  assert.ok(!fs.existsSync(path.join(siteDir, `${retired}.html`)), `Retired ${retired}.html remains`);
  assert.ok(!fs.existsSync(path.join(siteDir, retired)), `Retired /${retired}/ remains`);
}
for (const asset of ["reading-list.js", "note-share.js", "skills-evidence-manifest.json"]) {
  assert.ok(!fs.existsSync(path.join(siteDir, asset)), `Retired ${asset} remains`);
}

const htmlFiles = files(siteDir).filter((file) => file.endsWith(".html"));
for (const file of htmlFiles) {
  assert.ok(["index.html", "404.html"].includes(path.basename(file)), `Old named HTML output: ${file}`);
  const relative = path.relative(siteDir, file).split(path.sep).join("/");
  const publicUrl = `${origin}/${relative.replace(/index\.html$/, "")}`;
  const dom = new JSDOM(fs.readFileSync(file, "utf8"));
  const document = dom.window.document;
  assert.equal(document.querySelector("footer, [data-reading-list-shell], [data-reading-list-save], #reading-list-notes, [data-note-share]"), null, `${relative}: retired UI remains`);
  assert.equal(document.querySelector('meta[http-equiv="refresh"]'), null, `${relative}: unexpected redirect`);
  assert.equal(document.querySelector('link[rel="canonical"]').getAttribute("href"), publicUrl, `${relative}: wrong canonical`);
  for (const element of document.querySelectorAll("a[href], script[src], img[src], link[href]")) {
    const value = element.getAttribute(element.hasAttribute("href") ? "href" : "src");
    // The not-found page's own canonical is the one required named HTML file.
    if (value === `${origin}/404.html`) continue;
    checkUrl(value, publicUrl);
  }
  assert.ok(document.querySelector('script[type="module"][src^="/chat.js?v="]'), `${relative}: missing module chat`);
  dom.window.close();
}

for (const record of JSON.parse(fs.readFileSync(path.join(siteDir, "search-index.json"), "utf8"))) checkUrl(record.url, origin);
for (const node of JSON.parse(fs.readFileSync(path.join(siteDir, "graph.json"), "utf8")).nodes) {
  if (node.url) checkUrl(node.url, origin);
}
for (const [file, selector] of [["feed.xml", "entry > link"], ["sitemap.xml", "loc"]]) {
  const dom = new JSDOM(fs.readFileSync(path.join(siteDir, file), "utf8"), { contentType: "text/xml" });
  for (const element of dom.window.document.querySelectorAll(selector)) checkUrl(element.getAttribute("href") || element.textContent, origin);
  dom.window.close();
}
console.log(`Verified clean URLs, internal destinations and removed UI across ${htmlFiles.length} pages.`);
