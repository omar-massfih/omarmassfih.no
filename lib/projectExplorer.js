const isPublishedProject = (project) => !project.draft;

export default function buildProjectExplorer(projects = []) {
  const publishedProjects = projects.filter(isPublishedProject);
  const featuredProject = publishedProjects.find(
    (project) => project.source === "case study"
  );
  const standardProjects = featuredProject
    ? publishedProjects.filter((project) => project !== featuredProject)
    : publishedProjects;
  const technologies = new Set();
  const sources = new Set();

  for (const project of publishedProjects) {
    if (Array.isArray(project.tags)) {
      for (const tag of project.tags) {
        if (typeof tag === "string" && tag) technologies.add(tag);
      }
    }
    if (typeof project.source === "string" && project.source) {
      sources.add(project.source);
    }
  }

  const sortOptions = (values) =>
    [...values].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

  return {
    projects: publishedProjects,
    featuredProject,
    standardProjects,
    technologies: sortOptions(technologies),
    sources: sortOptions(sources),
  };
}

export { isPublishedProject };
