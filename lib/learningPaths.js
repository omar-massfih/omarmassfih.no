export const LEARNING_PATHS = Object.freeze([
  Object.freeze({
    slug: "distributed-systems",
    title: "Distributed systems",
    description:
      "Build a foundation for reasoning about reliability, scale, trade-offs, and failure across networked services.",
    noteSlugs: Object.freeze([
      "distributed-systems/reliable-scalable-maintainable",
      "distributed-systems/reliability",
      "distributed-systems/scalability",
      "distributed-systems/maintainability",
      "distributed-systems/failure-detection",
      "distributed-systems/cap-pacelc",
    ]),
  }),
  Object.freeze({
    slug: "data-engineering",
    title: "Data engineering",
    description:
      "Start with dependable system design, then connect architectural trade-offs to operating a modern data platform.",
    noteSlugs: Object.freeze([
      "distributed-systems/reliable-scalable-maintainable",
      "distributed-systems/scalability",
      "software-architecture/three-laws-of-software-architecture",
      "agentic-ai/agentic-triage-for-data-platform-failures",
    ]),
  }),
  Object.freeze({
    slug: "rag",
    title: "RAG",
    description:
      "Follow a retrieval-augmented generation system from its core idea through chunking, retrieval, generation, and evaluation.",
    noteSlugs: Object.freeze([
      "rag/retrieval-augmented-generation",
      "rag/chunking",
      "rag/embeddings",
      "rag/retrieval",
      "rag/generation",
      "rag/evaluation-ragas",
      "rag/knowledge-graphs",
      "rag/masters-thesis-slides-vs-textbooks",
    ]),
  }),
]);

function resolvedNote(note) {
  return {
    slug: note.slug,
    list_title: note.list_title,
    title: note.title,
    description: note.description,
    url: note.url,
    reading_time_minutes: note.reading_time_minutes,
    reading_time_text: note.reading_time_text,
  };
}

export default function buildLearningPaths(notes = [], paths = LEARNING_PATHS) {
  const notesBySlug = new Map(notes.map((note) => [note.slug, note]));

  return paths.map((path) => {
    const seen = new Set();
    const resolvedNotes = [];

    for (const slug of path.noteSlugs) {
      if (seen.has(slug)) {
        throw new Error(`Learning path "${path.slug}" contains duplicate note slug "${slug}".`);
      }
      seen.add(slug);

      const note = notesBySlug.get(slug);
      if (!note) {
        throw new Error(
          `Learning path "${path.slug}" references missing published note "${slug}".`
        );
      }
      if (note.published === false) continue;

      resolvedNotes.push(resolvedNote(note));
    }

    if (!resolvedNotes.length) {
      throw new Error(`Learning path "${path.slug}" has no published notes.`);
    }

    const totalReadingTimeMinutes = resolvedNotes.reduce(
      (total, note) => total + note.reading_time_minutes,
      0
    );

    return {
      slug: path.slug,
      title: path.title,
      description: path.description,
      notes: resolvedNotes,
      note_count: resolvedNotes.length,
      total_reading_time_minutes: totalReadingTimeMinutes,
      total_reading_time_text: `${totalReadingTimeMinutes} min total`,
    };
  });
}
