const EMPTY_NAVIGATION = Object.freeze({
  previous: null,
  next: null,
  position: 0,
  total: 0,
});

function isSameNote(candidate, current) {
  if (
    typeof current.slug === "string" &&
    current.slug &&
    typeof candidate.slug === "string"
  ) {
    return candidate.slug === current.slug;
  }

  return (
    typeof current.url === "string" &&
    current.url &&
    typeof candidate.url === "string" &&
    candidate.url === current.url
  );
}

export default function getNoteNavigation(notes, current) {
  if (
    !Array.isArray(notes) ||
    !current ||
    typeof current !== "object" ||
    typeof current.category !== "string"
  ) {
    return EMPTY_NAVIGATION;
  }

  const categoryNotes = notes.filter(
    (note) => note && typeof note === "object" && note.category === current.category
  );
  const index = categoryNotes.findIndex((note) => isSameNote(note, current));

  if (index === -1) return EMPTY_NAVIGATION;

  return {
    previous: index > 0 ? categoryNotes[index - 1] : null,
    next: index < categoryNotes.length - 1 ? categoryNotes[index + 1] : null,
    position: index + 1,
    total: categoryNotes.length,
  };
}
