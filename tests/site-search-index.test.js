import assert from "node:assert/strict";
import test from "node:test";
import buildSiteSearchIndex from "../lib/siteSearchIndex.js";

test("builds searchable note records without emitting HTML", () => {
  const records = buildSiteSearchIndex([{
    title: "Hidden title",
    list_title: "Control Plane",
    url: "/notes/control/",
    description: "A <strong>concise</strong> summary",
    category: "Distributed systems",
    tags: ["control-plane"],
    content_html: "<p>Leader &amp; follower</p><script>unsafe()</script>",
  }], [], {});

  assert.deepEqual(Object.keys(records[0]), [
    "type", "title", "url", "summary", "keywords", "searchText",
  ]);
  assert.equal(records[0].title, "Control Plane");
  assert.equal(records[0].summary, "A concise summary");
  assert.doesNotMatch(records[0].searchText, /<strong>|<\/strong>/);
  assert.match(records[0].searchText, /distributed systems control-plane leader & follower/);
  assert.doesNotMatch(JSON.stringify(records[0]), /<p>|<script>|unsafe/);
});

test("excludes truthy draft projects and indexes published project metadata", () => {
  const records = buildSiteSearchIndex([], [
    { name: "Draft", url: "/draft", draft: true },
    { name: "String draft", url: "/string-draft", draft: "true" },
    { name: "Numeric draft", url: "/numeric-draft", draft: 1 },
    {
      name: "Platform", url: "https://example.com/platform", summary: "GitOps",
      description: "Kubernetes deployment", tags: ["Flux"], source: "github", draft: false,
    },
  ], {});

  assert.deepEqual(
    records.map(({ title }) => title),
    ["Platform"]
  );
  assert.equal(records[0].url, "https://example.com/platform");
  assert.match(records[0].searchText, /gitops flux github kubernetes deployment/);
});

test("deduplicates skills case-insensitively and retains encountered groups", () => {
  const records = buildSiteSearchIndex([], [], { skills: [
    { group: "Languages", items: ["Python", "Git"] },
    { group: "Data", items: ["python", "SQL"] },
  ] });

  assert.deepEqual(records.map(({ title }) => title), ["Python", "Git", "SQL"]);
  assert.deepEqual(records[0].keywords, ["Languages", "Data"]);
  assert.equal(records[0].url, "/cv.html#skills");
});

test("preserves deterministic type and source order with malformed optional data", () => {
  const records = buildSiteSearchIndex(
    [{ title: "N1", url: "/n1" }, null, { title: "N2", url: "/n2", tags: "bad" }],
    [{ name: "P1", url: "/p1" }, null],
    { skills: [{ items: ["S1", null, ""] }] }
  );

  assert.deepEqual(records.map(({ title }) => title), ["N1", "N2", "P1", "S1"]);
  assert.deepEqual(records.map(({ type }) => type), ["note", "note", "project", "skill"]);
  assert.ok(records.every(({ searchText }) => typeof searchText === "string"));
});

test("preserves invalid numeric entities without aborting index generation", () => {
  const records = buildSiteSearchIndex([{
    title: "Malformed entities",
    url: "/notes/entities/",
    description: "Too large: &#99999999; surrogate: &#xD800; valid: &#x1f680;",
  }]);

  assert.equal(
    records[0].summary,
    "Too large: &#99999999; surrogate: &#xD800; valid: 🚀"
  );
});
