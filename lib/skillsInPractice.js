function fail(message) {
  throw new Error(`[skillsInPractice] ${message}`);
}

function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

export default function buildSkillsInPractice(cv, projects, backendNotes, skillEvidence) {
  const groups = cv?.skills || [];
  const cvSkills = groups.flatMap((group) => group.items || []);
  const cvSkillSet = new Set(cvSkills);
  const mappings = skillEvidence || {};

  for (const skill of Object.keys(mappings)) {
    if (!cvSkillSet.has(skill)) fail(`Mapping key "${skill}" is not a CV competency.`);
  }

  const projectIndex = new Map((projects || []).map((project) => [project.name, project]));
  const noteIndex = new Map((backendNotes || []).map((note) => [note.slug, note]));

  return groups.map((group) => ({
    group: group.group,
    skills: (group.items || []).map((skill) => {
      if (!Object.hasOwn(mappings, skill)) fail(`CV competency "${skill}" has no mapping.`);

      const mapping = mappings[skill] || {};
      const projectIds = mapping.projects || [];
      const noteIds = mapping.notes || [];

      for (const [type, ids] of [["project", projectIds], ["note", noteIds]]) {
        const repeated = duplicates(ids);
        if (repeated.length) {
          fail(`CV competency "${skill}" has duplicate ${type} reference "${repeated[0]}".`);
        }
      }

      const resolvedProjects = projectIds.map((name) => {
        const project = projectIndex.get(name);
        if (!project) fail(`CV competency "${skill}" references missing project "${name}".`);
        return project;
      });
      const resolvedNotes = noteIds.map((slug) => {
        const note = noteIndex.get(slug);
        if (!note) fail(`CV competency "${skill}" references missing note "${slug}".`);
        return note;
      });

      const publishedProjects = resolvedProjects.filter((project) => project.draft !== true);
      const publishedNotes = resolvedNotes.filter((note) => note.published !== false);

      if (publishedProjects.length + publishedNotes.length === 0) {
        fail(`CV competency "${skill}" has no published evidence after exclusions.`);
      }

      return {
        name: skill,
        projects: publishedProjects,
        notes: publishedNotes,
      };
    }),
  }));
}
