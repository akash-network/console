import { MyTemplates } from "@src/components/templates/MyTemplates/MyTemplates";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default MyTemplates;

export const getServerSideProps = defineServerSideProps({
  route: "/templates/mine",
  if: context => isFeatureEnabled("template_marketplace", context)
});
