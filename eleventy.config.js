import crypto from "node:crypto";
import fs from "node:fs";

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/style.css");
  eleventyConfig.addPassthroughCopy("src/site-header.js");
  eleventyConfig.addPassthroughCopy("src/bilder");
  eleventyConfig.addPassthroughCopy("src/CNAME");

  eleventyConfig.addFilter("assetHash", (assetPath) => {
    const content = fs.readFileSync(`src${assetPath}`);
    return crypto.createHash("md5").update(content).digest("hex").slice(0, 8);
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
