import { ProjectsClient } from "@/components/projects/ProjectsClient";
import { requireUser } from "@/lib/auth";
import { listProjectsForUser } from "@/server/app-data/projects";

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await listProjectsForUser(user.id);

  return <ProjectsClient initialProjects={projects} initialLoaded />;
}
