import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const siteDir = path.resolve("_site");
const notesDir = path.join(siteDir, "notes");
const errors = [];

function walkHtmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkHtmlFiles(entryPath));
    if (entry.isFile() && entry.name.endsWith(".html")) files.push(entryPath);
  }

  return files;
}

function pageUrl(filePath) {
  return `/${path.relative(siteDir, filePath).split(path.sep).join("/")}`;
}

function stripQueryAndHash(href) {
  return href.split(/[?#]/, 1)[0];
}

function hrefToFile(href) {
  const cleanHref = stripQueryAndHash(href);
  const relativePath = cleanHref.replace(/^\/+/, "");
  return path.join(siteDir, relativePath.endsWith("/") ? `${relativePath}index.html` : relativePath);
}

const noteFiles = walkHtmlFiles(notesDir);

if (!noteFiles.length) {
  errors.push("No generated note HTML files found under _site/notes.");
}

for (const file of noteFiles) {
  const html = fs.readFileSync(file, "utf8");
  const currentUrl = pageUrl(file);
  const sectionMatch = html.match(
    /<section class="related-notes"[\s\S]*?<\/section>/
  );

  if (!sectionMatch) continue;

  const section = sectionMatch[0];
  const linkMatches = [...section.matchAll(/<a\s+[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/g)];

  if (!linkMatches.length) {
    errors.push(`${currentUrl}: Related notes section has no links.`);
    continue;
  }

  for (const [, href] of linkMatches) {
    if (!href || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
      errors.push(`${currentUrl}: Related note link is not an internal note URL: ${href}`);
      continue;
    }

    if (!href.startsWith("/notes/")) {
      errors.push(`${currentUrl}: Related note link must be an absolute /notes/ URL: ${href}`);
      continue;
    }

    if (stripQueryAndHash(href) === currentUrl) {
      errors.push(`${currentUrl}: Related notes section links to itself.`);
      continue;
    }

    if (!fs.existsSync(hrefToFile(href))) {
      errors.push(`${currentUrl}: Related note link target does not exist: ${href}`);
    }
  }
}

if (errors.length) {
  console.error("Related notes verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Verified related note links in ${noteFiles.length} generated note pages.`);
