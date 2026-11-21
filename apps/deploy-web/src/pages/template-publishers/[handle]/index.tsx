import type { FC } from "react";
import { z } from "zod";

import { PublisherPage } from "@src/components/templates/publisher/PublisherPage/PublisherPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

const TemplatePublisherPage: FC<{ handle: string }> = ({ handle }) => <PublisherPage key={handle} handle={handle} />;

export default TemplatePublisherPage;

export const getServerSideProps = defineServerSideProps({
  route: "/template-publishers/[handle]",
  schema: z.object({
    params: z.object({
      handle: z.string()
    })
  }),
  if: context => isFeatureEnabled("template_marketplace", context),
  handler: ({ params }) => ({ props: { handle: params.handle } })
});
