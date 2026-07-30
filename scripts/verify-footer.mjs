import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";

const siteDir = path.resolve("_site");
const errors = [];
const contactHrefs = [
  "mailto:me@omarmassfih.no",
  "https://www.linkedin.com/in/omarmassfih",
  "https://github.com/omar-massfih",
];
const navigationHrefs = [
  "/projects.html",
  "/notes.html",
  "/cv.html",
  "/about.html",
  "/feed.xml",
];
const expectedHrefs = [...contactHrefs, ...navigationHrefs];
const redirectPages = new Set(["om.html", "prosjekter.html"]);

function walkHtmlFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkHtmlFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
  });
}

function displayPath(filePath) {
  return path.relative(siteDir, filePath).split(path.sep).join("/");
}

function hrefToFile(href) {
  const relativePath = href.replace(/^\/+/, "");
  return path.join(siteDir, relativePath.endsWith("/") ? `${relativePath}index.html` : relativePath);
}

function verifyFooter(filePath) {
  const page = displayPath(filePath);
  const document = new JSDOM(fs.readFileSync(filePath, "utf8")).window.document;
  const footers = [...document.querySelectorAll("footer")];

  if (footers.length !== 1) {
    errors.push(`${page}: expected exactly one footer, found ${footers.length}.`);
    return;
  }

  const footer = footers[0];
  const main = document.querySelector("main");
  if (!main || !(main.compareDocumentPosition(footer) & 4)) {
    errors.push(`${page}: footer must appear after main.`);
  }

  const heading = footer.querySelector("h1, h2, h3, h4, h5, h6");
  if (!heading || heading.textContent.trim() !== "Get in touch") {
    errors.push(`${page}: missing visible “Get in touch” heading.`);
  }

  const navs = [...footer.querySelectorAll("nav")];
  const labels = navs.map((nav) => nav.getAttribute("aria-label")?.trim() || "");
  if (navs.length !== 2 || labels.some((label) => !label) || new Set(labels).size !== labels.length) {
    errors.push(`${page}: footer navigation landmarks need two distinct, non-empty labels.`);
  }
  if (!labels.includes("Contact") || !labels.includes("Footer")) {
    errors.push(`${page}: expected Contact and Footer navigation labels.`);
  }

  const links = [...footer.querySelectorAll("a")];
  for (const expectedHref of expectedHrefs) {
    const count = links.filter((link) => link.getAttribute("href") === expectedHref).length;
    if (count !== 1) {
      errors.push(`${page}: expected one ${expectedHref} link, found ${count}.`);
    }
  }
  if (links.length !== expectedHrefs.length) {
    errors.push(`${page}: expected ${expectedHrefs.length} footer links, found ${links.length}.`);
  }

  for (const link of links) {
    const href = link.getAttribute("href")?.trim() || "";
    const accessibleName = link.getAttribute("aria-label")?.trim() || link.textContent.trim();
    if (!accessibleName) errors.push(`${page}: footer link has no accessible name.`);
    if (!href || href.startsWith("#")) errors.push(`${page}: invalid footer href “${href}”.`);
    if (href.startsWith("/") && !fs.existsSync(hrefToFile(href))) {
      errors.push(`${page}: footer target does not exist: ${href}.`);
    }
  }

  const email = links.find((link) => link.getAttribute("href")?.startsWith("mailto:"));
  try {
    const parsed = new URL(email?.href || "");
    if (parsed.protocol !== "mailto:" || parsed.pathname !== "me@omarmassfih.no") {
      errors.push(`${page}: email link has the wrong address.`);
    }
  } catch {
    errors.push(`${page}: email link is malformed.`);
  }

  for (const [href, host, pathname] of [
    [contactHrefs[1], "www.linkedin.com", "/in/omarmassfih"],
    [contactHrefs[2], "github.com", "/omar-massfih"],
  ]) {
    try {
      const parsed = new URL(href);
      if (parsed.protocol !== "https:" || parsed.host !== host || parsed.pathname !== pathname) {
        errors.push(`${page}: external link is malformed: ${href}.`);
      }
    } catch {
      errors.push(`${page}: external link is malformed: ${href}.`);
    }
  }
}

const htmlFiles = walkHtmlFiles(siteDir);
const baseLayoutFiles = htmlFiles.filter((filePath) => !redirectPages.has(displayPath(filePath)));
if (!htmlFiles.length) errors.push("No generated HTML files found.");

const firstNote = baseLayoutFiles.find((filePath) => displayPath(filePath).startsWith("notes/"));
const representativePaths = [
  "index.html",
  "about.html",
  "projects/omarmassfih-no.html",
  "404.html",
  "notes.html",
];
if (firstNote) representativePaths.push(displayPath(firstNote));
else errors.push("No generated note HTML file found.");

for (const relativePath of representativePaths) {
  const filePath = path.join(siteDir, relativePath);
  if (!fs.existsSync(filePath)) errors.push(`Missing representative page ${relativePath}.`);
}

for (const filePath of baseLayoutFiles) verifyFooter(filePath);

for (const redirectPage of redirectPages) {
  const filePath = path.join(siteDir, redirectPage);
  if (!fs.existsSync(filePath)) errors.push(`Expected redirect page ${redirectPage} is missing.`);
  else if (new JSDOM(fs.readFileSync(filePath, "utf8")).window.document.querySelector("footer")) {
    errors.push(`${redirectPage}: redirect page must not contain the site footer.`);
  }
}

if (errors.length) {
  console.error("Footer verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Verified the footer and its links across ${baseLayoutFiles.length} generated HTML pages.`);
