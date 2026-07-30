import buildNoteCategories from "../../lib/noteCategories.js";
import loadBackendNotes from "./backendNotes.js";

export default async function () {
  return buildNoteCategories(await loadBackendNotes());
}
