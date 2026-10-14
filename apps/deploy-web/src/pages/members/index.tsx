import { MembersPage } from "@src/components/organizations/MembersPage/MembersPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default MembersPage;

export const getServerSideProps = defineServerSideProps({
  route: "/members",
  if: context => isFeatureEnabled("organizations", context)
});
