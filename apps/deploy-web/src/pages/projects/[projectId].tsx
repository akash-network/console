import { z } from "zod";

import { ProjectPage } from "@src/components/projects/ProjectPage/ProjectPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default ProjectPage;

export const getServerSideProps = defineServerSideProps({
  route: "/projects/[projectId]",
  schema: z.object({
    params: z.object({
      projectId: z.string().min(1)
    })
  }),
  async handler({ params }) {
    return {
      props: {
        projectId: params.projectId
      }
    };
  }
});
