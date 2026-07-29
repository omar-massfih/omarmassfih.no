import assert from "node:assert/strict";
import test from "node:test";
import buildSkillsInPractice from "../lib/skillsInPractice.js";

const cv = {
  skills: [
    { group: "First", items: ["Python", "Git"] },
    { group: "Second", items: ["Java"] },
  ],
};
const projects = [
  { name: "Agent", url: "/agent", draft: false },
  { name: "Draft", url: "/draft", draft: true },
];
const notes = [
  { slug: "python/note", url: "/notes/python.html", published: true },
  { slug: "hidden/note", url: "/notes/hidden.html", published: false },
];
const mapping = {
  Python: { projects: ["Agent"], notes: ["python/note"] },
  Git: { projects: ["Agent"] },
  Java: { notes: ["python/note"] },
};

test("resolves canonical records and preserves CV group and competency order", () => {
  const result = buildSkillsInPractice(cv, projects, notes, mapping);

  assert.deepEqual(result.map((group) => group.group), ["First", "Second"]);
  assert.deepEqual(result.flatMap((group) => group.skills.map((skill) => skill.name)), [
    "Python", "Git", "Java",
  ]);
  assert.equal(result[0].skills[0].projects[0], projects[0]);
  assert.equal(result[0].skills[0].notes[0], notes[0]);
});

test("rejects a mapping key that is not a CV competency", () => {
  assert.throws(
    () => buildSkillsInPractice(cv, projects, notes, { ...mapping, Rust: { projects: ["Agent"] } }),
    /Mapping key "Rust" is not a CV competency/
  );
});

test("rejects a CV competency without a mapping", () => {
  const { Java, ...incomplete } = mapping;
  assert.throws(
    () => buildSkillsInPractice(cv, projects, notes, incomplete),
    /CV competency "Java" has no mapping/
  );
});

test("rejects missing project and note references with the competency and identifier", () => {
  assert.throws(
    () => buildSkillsInPractice(cv, projects, notes, {
      ...mapping, Python: { projects: ["Missing"] },
    }),
    /CV competency "Python" references missing project "Missing"/
  );
  assert.throws(
    () => buildSkillsInPractice(cv, projects, notes, {
      ...mapping, Python: { notes: ["missing/note"] },
    }),
    /CV competency "Python" references missing note "missing\/note"/
  );
});

test("rejects duplicate references within a competency", () => {
  assert.throws(
    () => buildSkillsInPractice(cv, projects, notes, {
      ...mapping, Python: { projects: ["Agent", "Agent"] },
    }),
    /duplicate project reference "Agent"/
  );
  assert.throws(
    () => buildSkillsInPractice(cv, projects, notes, {
      ...mapping, Python: { notes: ["python/note", "python/note"] },
    }),
    /duplicate note reference "python\/note"/
  );
});

test("excludes draft projects and explicitly unpublished notes", () => {
  const result = buildSkillsInPractice(cv, projects, notes, {
    ...mapping,
    Python: {
      projects: ["Agent", "Draft"],
      notes: ["python/note", "hidden/note"],
    },
  });
  const python = result[0].skills[0];

  assert.deepEqual(python.projects.map((project) => project.name), ["Agent"]);
  assert.deepEqual(python.notes.map((note) => note.slug), ["python/note"]);
});

test("fails when exclusions leave a competency without published evidence", () => {
  assert.throws(
    () => buildSkillsInPractice(cv, projects, notes, {
      ...mapping, Python: { projects: ["Draft"], notes: ["hidden/note"] },
    }),
    /CV competency "Python" has no published evidence after exclusions/
  );
});

test("does not mutate inputs while resolving a valid project and note mix", () => {
  const cvBefore = structuredClone(cv);
  const projectsBefore = structuredClone(projects);
  const notesBefore = structuredClone(notes);
  const mappingBefore = structuredClone(mapping);

  buildSkillsInPractice(cv, projects, notes, mapping);

  assert.deepEqual(cv, cvBefore);
  assert.deepEqual(projects, projectsBefore);
  assert.deepEqual(notes, notesBefore);
  assert.deepEqual(mapping, mappingBefore);
});
