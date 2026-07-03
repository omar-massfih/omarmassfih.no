import crypto from "node:crypto";
import fs from "node:fs";
import hljs from "highlight.js";

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
  eleventyConfig.addPassthroughCopy("src/CNAME");

  eleventyConfig.addFilter("assetHash", (assetPath) => {
    const content = fs.readFileSync(`src${assetPath}`);
    return crypto.createHash("md5").update(content).digest("hex").slice(0, 8);
  });

  eleventyConfig.addTransform("highlightCode", function (content) {
    if (!this.page.outputPath?.endsWith(".html")) return content;
    return content.replace(
      /(<code class="language-([a-z]+)">)([\s\S]*?)(<\/code>)/g,
      (match, open, language, code, close) => {
        if (!hljs.getLanguage(language)) return match;
        const { value } = hljs.highlight(decodeEntities(code), { language });
        return `<code class="language-${language} hljs">${value}${close}`;
      }
    );
  });

  eleventyConfig.addCollection("notater", (api) =>
    api.getFilteredByGlob("src/notatmappe/**/*.html")
  );

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
