const ENGINEERING_CASE_STUDY_URL = "/projects/omarmassfih-no.html";
const FEATURED_PROJECT_COUNT = 2;
const FEATURED_NOTE_COUNT = 2;

export default function buildFeaturedWork(projects = [], backendNotes = []) {
  const publishedProjects = projects.filter((project) => !project?.draft);
  const caseStudy = publishedProjects.find(
    (project) => project.url === ENGINEERING_CASE_STUDY_URL
  );
  const featuredProjects = [];
  const selectedProjectUrls = new Set();

  if (caseStudy) {
    featuredProjects.push(caseStudy);
    selectedProjectUrls.add(caseStudy.url);
  }

  for (const project of publishedProjects) {
    if (featuredProjects.length >= FEATURED_PROJECT_COUNT) break;
    if (!selectedProjectUrls.has(project.url)) {
      featuredProjects.push(project);
      selectedProjectUrls.add(project.url);
    }
  }

  return {
    projects: featuredProjects,
    notes: backendNotes.slice(0, FEATURED_NOTE_COUNT),
  };
}

export {
  ENGINEERING_CASE_STUDY_URL,
  FEATURED_PROJECT_COUNT,
  FEATURED_NOTE_COUNT,
};
