import type { FC } from "react";
import { z } from "zod";

import type { PublisherRouteProps } from "@src/components/templates/publisher/PublisherPage/loadPublisherRouteProps";
import { loadPublisherRouteProps } from "@src/components/templates/publisher/PublisherPage/loadPublisherRouteProps";
import { PublisherPage } from "@src/components/templates/publisher/PublisherPage/PublisherPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

const TemplatePublisherPage: FC<PublisherRouteProps> = ({ handle }) => <PublisherPage key={handle} handle={handle} />;

export default TemplatePublisherPage;

export const getServerSideProps = defineServerSideProps({
  route: "/template-publishers/[handle]",
  public: true,
  schema: z.object({
    params: z.object({
      handle: z.string()
    })
  }),
  handler: context => loadPublisherRouteProps(context.params.handle, context)
});
