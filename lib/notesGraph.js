// Minimum shared tags for two notes to be linked directly. Raise it if the
// note-to-note web gets too dense as more notes are published.
const MIN_SHARED_TAGS = 2;

export default function buildNotesGraph(notes) {
  const nodes = [];
  const links = [];
  const tagIds = new Set();

  for (const note of notes) {
    nodes.push({
      id: `note:${note.slug}`,
      type: "note",
      label: note.list_title || note.title,
      category: note.category || "Notes",
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

  // Note-to-note edges: connect any two notes sharing tags, weighted by how many.
  // These are detected downstream by both endpoint ids starting with "note:".
  const tagSets = notes.map((note) => new Set(note.tags || []));
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      let shared = 0;
      for (const tag of tagSets[i]) {
        if (tagSets[j].has(tag)) shared++;
      }
      if (shared >= MIN_SHARED_TAGS) {
        links.push({
          source: `note:${notes[i].slug}`,
          target: `note:${notes[j].slug}`,
          weight: shared,
        });
      }
    }
  }

  return { nodes, links };
}

export function getNotesGraphNeighborhood(graph, rootId) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.links)) {
    return { nodes: [], links: [] };
  }
  if (!graph.nodes.some((node) => node.id === rootId)) return { nodes: [], links: [] };

  const keep = new Set([rootId]);
  for (const link of graph.links) {
    if (link.source === rootId) keep.add(link.target);
    if (link.target === rootId) keep.add(link.source);
  }
  for (const link of graph.links) {
    if (keep.has(link.target) && link.target.startsWith("tag:")) keep.add(link.source);
    if (keep.has(link.source) && link.source.startsWith("tag:")) keep.add(link.target);
  }

  return {
    nodes: graph.nodes.filter((node) => keep.has(node.id)),
    links: graph.links.filter((link) => keep.has(link.source) && keep.has(link.target)),
  };
}
