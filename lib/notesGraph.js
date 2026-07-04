export default function buildNotesGraph(notes) {
  const nodes = [];
  const links = [];
  const tagIds = new Set();

  for (const note of notes) {
    nodes.push({
      id: `note:${note.slug}`,
      type: "note",
      label: note.list_title || note.title,
      url: note.url,
    });
  }

  for (const note of notes) {
    for (const tag of note.tags || []) {
      const tagId = `tag:${tag}`;

      if (!tagIds.has(tagId)) {
        tagIds.add(tagId);
        nodes.push({ id: tagId, type: "tag", label: tag });
      }

      links.push({ source: `note:${note.slug}`, target: tagId });
    }
  }

  return { nodes, links };
}
