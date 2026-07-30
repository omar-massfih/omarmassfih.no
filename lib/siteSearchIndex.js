import { isPublishedProject } from "./projectExplorer.js";

const normalize = (value) =>
  String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const decodeNumericEntity = (entity, digits, radix) => {
  const codePoint = Number.parseInt(digits, radix);
  const isUnicodeScalar =
    Number.isInteger(codePoint) &&
    codePoint >= 0 &&
    codePoint <= 0x10ffff &&
    !(codePoint >= 0xd800 && codePoint <= 0xdfff);
  return isUnicodeScalar ? String.fromCodePoint(codePoint) : entity;
};

const decodeEntities = (value) =>
  value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&#(\d+);/g, (entity, code) => decodeNumericEntity(entity, code, 10))
    .replace(/&#x([\da-f]+);/gi, (entity, code) => decodeNumericEntity(entity, code, 16));

const plainText = (value) =>
  decodeEntities(
    String(value ?? "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();

const strings = (value) =>
  (Array.isArray(value) ? value : []).map((item) => String(item ?? "").trim()).filter(Boolean);

const record = ({ type, title, url, summary = "", keywords = [], searchable = [] }) => {
  const cleanSummary = plainText(summary);
  return {
    type,
    title: String(title ?? "").trim(),
    url: String(url ?? "").trim(),
    summary: cleanSummary,
    keywords,
    searchText: normalize([title, cleanSummary, ...keywords, ...searchable].join(" ")),
  };
};

export default function buildSiteSearchIndex(backendNotes = [], projects = [], cv = {}) {
  const output = [];

  for (const note of Array.isArray(backendNotes) ? backendNotes : []) {
    if (!note || typeof note !== "object") continue;
    const title = note.list_title || note.title || "";
    const keywords = [note.category, ...strings(note.tags)].filter(Boolean);
    output.push(record({
      type: "note",
      title,
      url: note.url,
      summary: note.description,
      keywords,
      searchable: [plainText(note.content_html)],
    }));
  }

  for (const project of Array.isArray(projects) ? projects : []) {
    if (!project || typeof project !== "object" || !isPublishedProject(project)) continue;
    const keywords = [...strings(project.tags), project.source].filter(Boolean);
    output.push(record({
      type: "project",
      title: project.name,
      url: project.url,
      summary: project.summary || project.description,
      keywords,
      searchable: [project.description],
    }));
  }

  const skills = Array.isArray(cv?.skills) ? cv.skills : [];
  const seen = new Map();
  for (const group of skills) {
    const groupName = String(group?.group ?? "").trim();
    for (const item of strings(group?.items)) {
      const key = normalize(item);
      if (!key) continue;
      if (seen.has(key)) {
        const existing = seen.get(key);
        if (groupName && !existing.keywords.includes(groupName)) {
          existing.keywords.push(groupName);
          existing.searchText = normalize(
            [existing.title, existing.summary, ...existing.keywords].join(" ")
          );
        }
        continue;
      }
      const skill = record({
        type: "skill",
        title: item,
        url: "/cv.html#skills",
        summary: groupName,
        keywords: groupName ? [groupName] : [],
      });
      seen.set(key, skill);
      output.push(skill);
    }
  }

  return output;
}

export { normalize, plainText };
