import { ProjectsPage } from "@src/components/projects/ProjectsPage/ProjectsPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default ProjectsPage;

export const getServerSideProps = defineServerSideProps({
  route: "/projects"
});
