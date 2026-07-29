import assert from "node:assert/strict";
import test from "node:test";
import getNoteNavigation from "../lib/noteNavigation.js";

const notes = [
  { slug: "newest-a", url: "/notes/newest-a.html", title: "Newest A", category: "A", date: "2026-01-02" },
  { slug: "newest-b", url: "/notes/newest-b.html", title: "Newest B", category: "B", date: "2026-01-03" },
  { slug: "middle-a", url: "/notes/middle-a.html", title: "Middle A", category: "A", date: "2026-01-02" },
  { slug: "oldest-a", url: "/notes/oldest-a.html", title: "Oldest A", category: "A", date: "2025-12-01" },
];

test("preserves supplied order and restricts navigation to the category", () => {
  const navigation = getNoteNavigation(notes, notes[2]);

  assert.equal(navigation.previous, notes[0]);
  assert.equal(navigation.next, notes[3]);
  assert.equal(navigation.position, 2);
  assert.equal(navigation.total, 3);
});

test("first and last notes omit the unavailable category neighbor", () => {
  const first = getNoteNavigation(notes, notes[0]);
  const last = getNoteNavigation(notes, notes[3]);

  assert.equal(first.previous, null);
  assert.equal(first.next, notes[2]);
  assert.equal(first.position, 1);
  assert.equal(last.previous, notes[2]);
  assert.equal(last.next, null);
  assert.equal(last.position, 3);
});

test("a singleton category has position one and no neighbors", () => {
  assert.deepEqual(getNoteNavigation(notes, notes[1]), {
    previous: null,
    next: null,
    position: 1,
    total: 1,
  });
});

test("equal dates do not trigger an independent sort", () => {
  const equalDates = [
    { slug: "z", url: "/notes/z.html", category: "A", date: "2026-01-01" },
    { slug: "a", url: "/notes/a.html", category: "A", date: "2026-01-01" },
  ];

  assert.equal(getNoteNavigation(equalDates, equalDates[1]).previous, equalDates[0]);
});

test("uses URL identity when a slug is unavailable", () => {
  const current = { url: "/notes/middle-a.html", category: "A" };

  assert.equal(getNoteNavigation(notes, current).position, 2);
});

test("malformed, missing, and unknown current notes fail safely", () => {
  const empty = { previous: null, next: null, position: 0, total: 0 };

  assert.deepEqual(getNoteNavigation(null, notes[0]), empty);
  assert.deepEqual(getNoteNavigation(notes, null), empty);
  assert.deepEqual(getNoteNavigation(notes, { slug: "missing", category: "A" }), empty);
  assert.deepEqual(getNoteNavigation(notes, { slug: "newest-a" }), empty);
});
