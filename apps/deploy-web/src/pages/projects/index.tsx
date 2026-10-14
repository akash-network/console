import { ProjectsPage } from "@src/components/projects/ProjectsPage/ProjectsPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default ProjectsPage;

export const getServerSideProps = defineServerSideProps({
  route: "/projects",
  if: context => isFeatureEnabled("organizations", context)
});
