import { JSDOM } from "jsdom";

const LAYOUT_RESERVED_IDS = new Set(["note-toc-heading"]);

function slugify(text) {
  const slug = text
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
}

function isValidAuthoredId(id) {
  return Boolean(id) && !/[\t\n\f\r ]/u.test(id);
}

function uniqueId(preferredId, usedIds) {
  if (!usedIds.has(preferredId)) {
    usedIds.add(preferredId);
    return preferredId;
  }

  let suffix = 2;
  while (usedIds.has(`${preferredId}-${suffix}`)) suffix += 1;

  const id = `${preferredId}-${suffix}`;
  usedIds.add(id);
  return id;
}

export default function processNoteHeadings(contentHtml = "") {
  const dom = new JSDOM(`<body>${String(contentHtml)}</body>`);
  const { document } = dom.window;
  const headings = [...document.body.querySelectorAll("h2, h3")];

  if (!headings.length) {
    return { content_html: contentHtml, toc: [] };
  }

  // Reserve every fragment target before generating any slugs. This lets an
  // authored heading keep its ID even when an earlier heading has matching
  // text, and prevents generated heading IDs from shadowing body/layout IDs.
  const reservedIds = new Set(LAYOUT_RESERVED_IDS);
  const idOwners = new Map();
  for (const element of document.body.querySelectorAll("[id]")) {
    const id = element.getAttribute("id");
    if (!isValidAuthoredId(id)) continue;

    reservedIds.add(id);
    const owners = idOwners.get(id) ?? [];
    owners.push(element);
    idOwners.set(id, owners);
  }

  const assignedHeadingIds = new Set();
  const toc = [];

  for (const heading of headings) {
    const text = heading.textContent.trim().replace(/\s+/g, " ");
    const authoredId = heading.getAttribute("id");
    let id;

    const authoredIdIsUnique =
      isValidAuthoredId(authoredId) &&
      !LAYOUT_RESERVED_IDS.has(authoredId) &&
      idOwners.get(authoredId)?.length === 1 &&
      idOwners.get(authoredId)[0] === heading;

    if (authoredIdIsUnique && !assignedHeadingIds.has(authoredId)) {
      id = authoredId;
    } else {
      const preferredId = isValidAuthoredId(authoredId) ? authoredId : slugify(text);
      id = uniqueId(preferredId, new Set([...reservedIds, ...assignedHeadingIds]));
    }

    heading.id = id;
    assignedHeadingIds.add(id);
    reservedIds.add(id);

    const anchor = document.createElement("a");
    anchor.className = "heading-anchor";
    anchor.href = `#${encodeURIComponent(id)}`;
    anchor.setAttribute("aria-label", `Permalink to ${text || "this section"}`);

    const symbol = document.createElement("span");
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = "#";
    anchor.append(symbol);
    heading.append(anchor);

    toc.push({
      id,
      text,
      level: Number.parseInt(heading.tagName.slice(1), 10),
    });
  }

  return {
    content_html: document.body.innerHTML,
    toc,
  };
}

export { slugify };
