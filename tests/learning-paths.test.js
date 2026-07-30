import assert from "node:assert/strict";
import test from "node:test";
import buildLearningPaths from "../lib/learningPaths.js";

const notes = [
  {
    slug: "notes/one",
    list_title: "One for lists",
    title: "One",
    description: "First",
    url: "/notes/one.html",
    reading_time_minutes: 2,
    reading_time_text: "2 min read",
  },
  {
    slug: "notes/two",
    title: "Two",
    description: "Second",
    url: "/notes/two.html",
    reading_time_minutes: 5,
    reading_time_text: "5 min read",
  },
  {
    slug: "notes/draft",
    title: "Draft",
    url: "/notes/draft.html",
    reading_time_minutes: 20,
    reading_time_text: "20 min read",
    published: false,
  },
];

const paths = [
  {
    slug: "second",
    title: "Second path",
    description: "Second description",
    noteSlugs: ["notes/two"],
  },
  {
    slug: "first",
    title: "First path",
    description: "First description",
    noteSlugs: ["notes/one", "notes/draft", "notes/two"],
  },
];

test("resolves paths and notes in declared order using canonical note metadata", () => {
  const result = buildLearningPaths(notes, paths);

  assert.deepEqual(result.map((path) => path.slug), ["second", "first"]);
  assert.deepEqual(result[1].notes.map((note) => note.slug), ["notes/one", "notes/two"]);
  assert.equal(result[1].notes[0].list_title, "One for lists");
  assert.equal(result[1].notes[0].url, "/notes/one.html");
  assert.equal(result[1].notes[0].reading_time_text, "2 min read");
  assert.equal(result[1].note_count, 2);
  assert.equal(result[1].total_reading_time_minutes, 7);
  assert.equal(result[1].total_reading_time_text, "7 min total");
});

test("rejects a missing configured note with path and slug context", () => {
  assert.throws(
    () => buildLearningPaths(notes, [{
      slug: "broken",
      title: "Broken",
      description: "Broken",
      noteSlugs: ["notes/missing"],
    }]),
    /Learning path "broken" references missing published note "notes\/missing"/
  );
});

test("excludes explicitly unpublished notes", () => {
  const [path] = buildLearningPaths(notes, [{
    slug: "published-only",
    title: "Published only",
    description: "Published only",
    noteSlugs: ["notes/draft", "notes/one"],
  }]);

  assert.deepEqual(path.notes.map((note) => note.slug), ["notes/one"]);
  assert.equal(path.total_reading_time_minutes, 2);
});

test("rejects a path left empty by publication filtering", () => {
  assert.throws(
    () => buildLearningPaths(notes, [{
      slug: "drafts",
      title: "Drafts",
      description: "Drafts",
      noteSlugs: ["notes/draft"],
    }]),
    /Learning path "drafts" has no published notes/
  );
});

test("rejects duplicate slugs within a path", () => {
  assert.throws(
    () => buildLearningPaths(notes, [{
      slug: "duplicates",
      title: "Duplicates",
      description: "Duplicates",
      noteSlugs: ["notes/one", "notes/one"],
    }]),
    /Learning path "duplicates" contains duplicate note slug "notes\/one"/
  );
});

test("does not mutate source notes or path configuration", () => {
  const notesBefore = structuredClone(notes);
  const pathsBefore = structuredClone(paths);

  buildLearningPaths(notes, paths);

  assert.deepEqual(notes, notesBefore);
  assert.deepEqual(paths, pathsBefore);
});
