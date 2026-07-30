import assert from "node:assert/strict";
import test from "node:test";
import buildNoteCategories, { slugifyCategory } from "../lib/noteCategories.js";

const notes = [
  { title: "Newest", category: "Kubernetes/k3s", date: "2026-07-30" },
  { title: "Other", category: "Cloud & Platform", date: "2026-07-29" },
  { title: "Older", category: "Kubernetes/k3s", date: "2026-07-01" },
];

test("builds category records while preserving note order", () => {
  const categories = buildNoteCategories(notes);

  assert.deepEqual(categories.map(({ title, slug, url, count, lastModified }) => ({
    title, slug, url, count, lastModified,
  })), [
    {
      title: "Kubernetes/k3s",
      slug: "kubernetes-k3s",
      url: "/notes/categories/kubernetes-k3s.html",
      count: 2,
      lastModified: "2026-07-30",
    },
    {
      title: "Cloud & Platform",
      slug: "cloud-platform",
      url: "/notes/categories/cloud-platform.html",
      count: 1,
      lastModified: "2026-07-29",
    },
  ]);
  assert.deepEqual(categories[0].notes.map((note) => note.title), ["Newest", "Older"]);
});

test("slugifies punctuation, separators, and accented characters deterministically", () => {
  assert.equal(slugifyCategory(" Kubernetes/k3s "), "kubernetes-k3s");
  assert.equal(slugifyCategory("Café + Cloud"), "cafe-cloud");
});

test("rejects category labels whose normalized slugs collide", () => {
  assert.throws(
    () => buildNoteCategories([
      { category: "Cloud/API", date: "2026-01-01" },
      { category: "Cloud API", date: "2026-01-02" },
    ]),
    /both produce the slug "cloud-api"/
  );
});

test("rejects category page URLs that collide with note URLs", () => {
  assert.throws(
    () => buildNoteCategories([
      {
        category: "Kubernetes",
        date: "2026-01-01",
        url: "/notes/categories/kubernetes.html",
      },
    ]),
    /collides with an existing note URL/
  );
});

test("returns no categories for no notes", () => {
  assert.deepEqual(buildNoteCategories([]), []);
});
