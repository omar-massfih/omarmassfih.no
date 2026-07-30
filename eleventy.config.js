import crypto from "node:crypto";
import fs from "node:fs";
import hljs from "highlight.js";
import buildNotesGraph from "./lib/notesGraph.js";
import getRelatedNotes from "./lib/relatedNotes.js";
import getNoteNavigation from "./lib/noteNavigation.js";
import buildSkillsInPractice from "./lib/skillsInPractice.js";
import buildProjectExplorer from "./lib/projectExplorer.js";
import buildFeaturedWork from "./lib/featuredWork.js";
import buildSiteSearchIndex from "./lib/siteSearchIndex.js";

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
  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/graph.js");
  eleventyConfig.addPassthroughCopy("src/chat.js");
  eleventyConfig.addPassthroughCopy("src/notes-filter.js");
  eleventyConfig.addPassthroughCopy("src/projects-filter.js");
  eleventyConfig.addPassthroughCopy("src/site-search.js");
  eleventyConfig.addPassthroughCopy("src/note-code-copy.js");
  eleventyConfig.addPassthroughCopy("src/note-reading-progress.js");
  eleventyConfig.addPassthroughCopy("src/note-share.js");

  // graphHash runs on every note page; keyed on the notes array so the graph
  // is built once per data load instead of once per page.
  const graphCache = new WeakMap();
  const serializedGraph = (notes) => {
    if (!graphCache.has(notes)) {
      graphCache.set(notes, JSON.stringify(buildNotesGraph(notes)));
    }
    return graphCache.get(notes);
  };

  eleventyConfig.addFilter("graphJson", (notes) =>
    serializedGraph(notes).replace(/</g, "\\u003c")
  );

  eleventyConfig.addFilter("notesSearchJson", (notes) => {
    const metadata = notes.map((note) => ({
      url: note.url,
      title: note.list_title || note.title || "",
      description: note.description || "",
      category: note.category || "",
      tags: note.tags || [],
    }));

    return JSON.stringify(metadata).replace(/</g, "\\u003c");
  });

  eleventyConfig.addFilter("backendNotesManifestJson", (notes) =>
    JSON.stringify(notes.map(({ slug, url, published }) => ({ slug, url, published })))
      .replace(/</g, "\\u003c")
  );

  eleventyConfig.addFilter("graphHash", (notes) =>
    crypto.createHash("md5").update(serializedGraph(notes)).digest("hex").slice(0, 8)
  );

  eleventyConfig.addFilter("assetHash", (assetPath) => {
    const content = fs.readFileSync(`src${assetPath}`);
    return crypto.createHash("md5").update(content).digest("hex").slice(0, 8);
  });

  eleventyConfig.addFilter("relatedNotes", (notes, note, limit = 5) =>
    getRelatedNotes(notes, note, limit)
  );
  eleventyConfig.addFilter("noteNavigation", getNoteNavigation);

  eleventyConfig.addFilter("skillsInPractice", buildSkillsInPractice);
  eleventyConfig.addFilter("projectExplorer", buildProjectExplorer);
  eleventyConfig.addFilter("featuredWork", buildFeaturedWork);
  eleventyConfig.addFilter("siteSearchIndex", (notes, projects, cv) =>
    JSON.stringify(buildSiteSearchIndex(notes, projects, cv)).replace(/</g, "\\u003c")
  );

  eleventyConfig.addTransform("highlightCode", function (content) {
    if (typeof this.page.outputPath !== "string" || !this.page.outputPath.endsWith(".html")) {
      return content;
    }
    return content.replace(
      /(<code class="language-([a-z0-9-]+)">)([\s\S]*?)(<\/code>)/g,
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
