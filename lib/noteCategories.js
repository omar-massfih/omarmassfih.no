export function slugifyCategory(title) {
  return String(title || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function buildNoteCategories(notes = []) {
  const categories = new Map();
  const slugs = new Map();
  const noteUrls = new Set(notes.map((note) => note.url).filter(Boolean));

  for (const note of notes) {
    const title = String(note.category || "").trim();
    const slug = slugifyCategory(title);
    if (!slug) {
      throw new Error(`Note category "${title}" does not produce a usable URL slug.`);
    }

    const existingTitle = slugs.get(slug);
    if (existingTitle && existingTitle !== title) {
      throw new Error(
        `Note categories "${existingTitle}" and "${title}" both produce the slug "${slug}".`
      );
    }
    slugs.set(slug, title);

    if (!categories.has(title)) {
      const url = `/notes/categories/${slug}.html`;
      if (noteUrls.has(url)) {
        throw new Error(
          `Note category "${title}" would use "${url}", which collides with an existing note URL.`
        );
      }

      categories.set(title, {
        title,
        slug,
        url,
        notes: [],
        count: 0,
        lastModified: note.date,
      });
    }

    const category = categories.get(title);
    category.notes.push(note);
    category.count = category.notes.length;
    if (note.date > category.lastModified) category.lastModified = note.date;
  }

  return [...categories.values()];
}
