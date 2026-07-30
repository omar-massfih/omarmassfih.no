import assert from "node:assert/strict";
import test from "node:test";
import buildFeaturedWork, {
  ENGINEERING_CASE_STUDY_URL,
  FEATURED_NOTE_COUNT,
  FEATURED_PROJECT_COUNT,
} from "../lib/featuredWork.js";

const caseStudy = {
  name: "Case study",
  url: ENGINEERING_CASE_STUDY_URL,
  draft: false,
};

test("always selects the case study, then the first other published project", () => {
  const projects = [
    { name: "Draft", url: "/draft", draft: true },
    { name: "Truthy draft", url: "/truthy-draft", draft: "yes" },
    { name: "First", url: "/first", draft: false },
    { name: "Second", url: "/second", draft: false },
    caseStudy,
  ];

  assert.deepEqual(
    buildFeaturedWork(projects, []).projects.map(({ name }) => name),
    ["Case study", "First"]
  );
});

test("does not select distinct project records with the same case-study URL", () => {
  const duplicateCaseStudy = {
    name: "Duplicate case study",
    url: ENGINEERING_CASE_STUDY_URL,
    draft: false,
  };
  const result = buildFeaturedWork(
    [
      caseStudy,
      duplicateCaseStudy,
      { name: "Other", url: "/other", draft: false },
    ],
    []
  );

  assert.deepEqual(result.projects.map(({ name }) => name), ["Case study", "Other"]);
  assert.equal(
    new Set(result.projects.map(({ url }) => url)).size,
    result.projects.length
  );
});

test("preserves supplied note order and caps both selections safely", () => {
  const notes = [
    { title: "Newest", date: "2026-03-02" },
    { title: "Older", date: "2026-03-01" },
    { title: "Oldest", date: "2026-02-28" },
  ];
  const result = buildFeaturedWork(
    [caseStudy, { name: "Draft", draft: true }],
    notes
  );

  assert.equal(result.projects.length, 1);
  assert.equal(result.projects.length <= FEATURED_PROJECT_COUNT, true);
  assert.deepEqual(result.notes.map(({ title }) => title), ["Newest", "Older"]);
  assert.equal(result.notes.length, FEATURED_NOTE_COUNT);
});

test("is deterministic and does not mutate either input", () => {
  const projects = [
    { name: "First", url: "/first", draft: false },
    caseStudy,
  ];
  const notes = [{ title: "Newest" }, { title: "Older" }];
  const projectsSnapshot = structuredClone(projects);
  const notesSnapshot = structuredClone(notes);

  assert.deepEqual(
    buildFeaturedWork(projects, notes),
    buildFeaturedWork(projects, notes)
  );
  assert.deepEqual(projects, projectsSnapshot);
  assert.deepEqual(notes, notesSnapshot);
});
