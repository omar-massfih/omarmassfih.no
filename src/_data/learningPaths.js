import buildLearningPaths from "../../lib/learningPaths.js";
import loadBackendNotes from "./backendNotes.js";

export default async function () {
  return buildLearningPaths(await loadBackendNotes());
}
