// Cache the data promise so other global data derived from backendNotes sees
// the exact same snapshot without making a second backend request.
import loadBackendNotes from "../../lib/notesLoader.js";

let notesPromise;

export default function () {
  notesPromise ||= loadBackendNotes();
  return notesPromise;
}
