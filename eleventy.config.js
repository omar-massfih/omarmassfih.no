import crypto from "node:crypto";
import fs from "node:fs";
import hljs from "highlight.js";
import { createNotesGraph } from "./src/_data/notesGraph.js";

const decodeEntities = (html) =>
  html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/style.css");
  eleventyConfig.addPassthroughCopy("src/bilder");
  eleventyConfig.addPassthroughCopy("src/fonts");
  eleventyConfig.addPassthroughCopy("src/notes-graph.js");
  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

  eleventyConfig.addFilter("assetHash", (assetPath) => {
    const content = fs.readFileSync(`src${assetPath}`);
    return crypto.createHash("md5").update(content).digest("hex").slice(0, 8);
  });

  eleventyConfig.addFilter("json", (value) =>
    JSON.stringify(value).replace(/</g, "\\u003c")
  );

  eleventyConfig.addFilter("notesGraph", createNotesGraph);

  eleventyConfig.addTransform("highlightCode", function (content) {
    if (typeof this.page.outputPath !== "string" || !this.page.outputPath.endsWith(".html")) {
      return content;
    }
    return content.replace(
      /(<code class="language-([a-z]+)">)([\s\S]*?)(<\/code>)/g,
      (match, open, language, code, close) => {
        if (!hljs.getLanguage(language)) return match;
        const { value } = hljs.highlight(decodeEntities(code), { language });
        return `<code class="language-${language} hljs">${value}${close}`;
      }
    );
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    htmlTemplateEngine: "njk",
  };
}
