function noteDateValue(note) {
  const date = note.date || note.date_iso || "";
  const value = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isNaN(value) ? 0 : value;
}

export default function getRelatedNotes(notes, currentNote, limit = 5) {
  if (!Array.isArray(notes) || !currentNote) return [];

  const currentTags = new Set(currentNote.tags || []);
  if (!currentTags.size) return [];

  return notes
    .filter((candidate) => candidate && candidate.slug !== currentNote.slug)
    .map((candidate) => {
      const sharedTags = (candidate.tags || []).filter((tag) => currentTags.has(tag));

      return {
        title: candidate.list_title || candidate.title,
        url: candidate.url,
        date: candidate.date,
        date_text: candidate.date_text || candidate.date || "",
        sharedTags,
      };
    })
    .filter((candidate) => candidate.sharedTags.length)
    .sort((left, right) => {
      const sharedTagDifference = right.sharedTags.length - left.sharedTags.length;
      if (sharedTagDifference !== 0) return sharedTagDifference;

      const dateDifference = noteDateValue(right) - noteDateValue(left);
      if (dateDifference !== 0) return dateDifference;

      return String(left.title || "").localeCompare(String(right.title || ""));
    })
    .slice(0, limit);
}
