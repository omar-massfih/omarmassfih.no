import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { loadBackendNotes } from "../lib/notesLoader.js";

const SNAPSHOT_PATH = fileURLToPath(new URL("../notes-snapshot.json", import.meta.url));

const notes = await loadBackendNotes();
notes.sort((left, right) => right.date.localeCompare(left.date));

await writeFile(SNAPSHOT_PATH, `${JSON.stringify(notes, null, 2)}\n`);
console.log(`Wrote ${notes.length} notes to ${SNAPSHOT_PATH}`);
