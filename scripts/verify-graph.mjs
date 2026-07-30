import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";
import { getNotesGraphNeighborhood } from "../lib/notesGraph.js";

const site = path.resolve("_site");
const errors = [];
let graph;
try {
  graph = JSON.parse(fs.readFileSync(path.join(site, "graph.json"), "utf8"));
} catch (error) {
  errors.push(`graph.json is missing or invalid: ${error.message}`);
  graph = { nodes: [], links: [] };
}
const ids = new Set();
for (const node of graph.nodes || []) {
  if (!node.id || ids.has(node.id)) errors.push(`Invalid or duplicate node id: ${node.id}`);
  ids.add(node.id);
}
for (const link of graph.links || []) {
  if (!ids.has(link.source) || !ids.has(link.target)) errors.push(`Missing link endpoint: ${link.source} -> ${link.target}`);
}
const fileForUrl = (url) => path.join(site, url.replace(/^\/+/, ""));
const noteNodes = (graph.nodes || []).filter(({ type }) => type === "note");
for (const node of noteNodes) {
  if (!node.url || !fs.existsSync(fileForUrl(node.url))) errors.push(`Missing generated note: ${node.id} (${node.url})`);
}
const notesHtml = fs.readFileSync(path.join(site, "notes.html"), "utf8");
const notesDoc = new JSDOM(notesHtml).window.document;
if (notesDoc.querySelectorAll('.knowledge-graph[data-graph-size="full"]').length !== 1) errors.push("notes.html must have one full panel");
if (!notesDoc.querySelector(".graph-legend") || !notesDoc.querySelector("[data-graph-details]")) errors.push("notes.html lacks legend/details");
const fullFallback = new Set([...notesDoc.querySelectorAll(".graph-fallback a")].map((link) => link.getAttribute("href")));
for (const node of noteNodes) if (!fullFallback.has(node.url)) errors.push(`notes.html fallback omits ${node.url}`);
for (const node of noteNodes) {
  const doc = new JSDOM(fs.readFileSync(fileForUrl(node.url), "utf8")).window.document;
  const panel = doc.querySelector(".knowledge-graph[data-root-slug]");
  const local = getNotesGraphNeighborhood(graph, node.id);
  const tagged = local.links.some(({ source, target }) => source === node.id && target.startsWith("tag:"));
  if (!tagged) {
    if (panel) errors.push(`${node.url} has a graph despite having no tags`);
    continue;
  }
  if (!panel || panel.dataset.rootSlug !== node.id.slice(5)) {
    errors.push(`${node.url} lacks a correctly rooted local graph`);
    continue;
  }
  const actual = new Set([...doc.querySelectorAll(".graph-fallback a")].map((link) => link.getAttribute("href")));
  for (const localNode of local.nodes.filter(({ type }) => type === "note")) {
    if (!actual.has(localNode.url)) errors.push(`${node.url} fallback omits ${localNode.url}`);
  }
}
if (!fs.existsSync(path.join(site, "graph.js")) || !/graph\.js\?v=/.test(notesHtml)) errors.push("Versioned graph.js is missing");
if (errors.length) {
  console.error("Graph verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Verified ${noteNodes.length} graph notes, panels, and fallback links.`);
