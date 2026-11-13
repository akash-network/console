import { OrganizationSettingsPage } from "@src/components/organizations/OrganizationSettingsPage/OrganizationSettingsPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default OrganizationSettingsPage;

export const getServerSideProps = defineServerSideProps({
  route: "/organization"
});
