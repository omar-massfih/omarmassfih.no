const NOTE_LINK_PATTERN = /href=(["'])\/notes\/([^"']+?)\.html(?:#[^"']*)?\1/g;

function noteTitle(note) {
  return note.list_title || note.title || note.slug;
}

function categoryId(category) {
  return `category:${category}`;
}

export function createNotesGraph(notes = []) {
  const noteByUrl = new Map(notes.map((note) => [note.url, note]));
  const nodes = [];
  const edges = [];
  const categories = new Set();
  const directEdges = new Set();

  for (const note of notes) {
    const category = note.category || "Notes";
    categories.add(category);

    nodes.push({
      id: note.slug,
      type: "note",
      label: noteTitle(note),
      category,
      url: note.url,
    });

    edges.push({
      id: `${categoryId(category)}--${note.slug}`,
      source: categoryId(category),
      target: note.slug,
      type: "category",
      weight: 1,
    });
  }

  for (const category of categories) {
    nodes.push({
      id: categoryId(category),
      type: "category",
      label: category,
    });
  }

  for (const note of notes) {
    for (const match of String(note.content_html || "").matchAll(NOTE_LINK_PATTERN)) {
      const targetUrl = `/notes/${match[2]}.html`;
      const target = noteByUrl.get(targetUrl);

      if (!target || target.slug === note.slug) continue;

      const edgeId = [note.slug, target.slug].sort().join("--");
      if (directEdges.has(edgeId)) continue;

      directEdges.add(edgeId);
      edges.push({
        id: edgeId,
        source: note.slug,
        target: target.slug,
        type: "link",
        weight: 2,
      });
    }
  }

  return { nodes, edges };
}
