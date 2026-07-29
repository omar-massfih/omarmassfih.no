import { JSDOM } from "jsdom";

// A fixed 200 WPM keeps build output predictable and easy to audit.
export const WORDS_PER_MINUTE = 200;

const SEPARATING_ELEMENTS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "BR",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "UL",
]);

function renderedText(node) {
  if (node.nodeType === node.TEXT_NODE) return node.nodeValue;

  const text = [...node.childNodes].map(renderedText).join("");
  return node.nodeType === node.ELEMENT_NODE && SEPARATING_ELEMENTS.has(node.tagName)
    ? ` ${text} `
    : text;
}

export default function calculateReadingTime(renderedHtml) {
  const document = new JSDOM(`<body>${renderedHtml || ""}</body>`).window.document;

  document
    .querySelectorAll("script, style, template, noscript")
    .forEach((element) => element.remove());

  const text = renderedText(document.body).trim();
  const wordCount = text ? text.split(/\s+/).length : 0;

  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}
