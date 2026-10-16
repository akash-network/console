import { OrganizationSettingsPage } from "@src/components/organizations/OrganizationSettingsPage/OrganizationSettingsPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default OrganizationSettingsPage;

export const getServerSideProps = defineServerSideProps({
  route: "/organization",
  if: context => isFeatureEnabled("organizations", context)
});
