/* v8 ignore start */

import { ReferralsPage } from "@src/components/referrals/ReferralsPage/ReferralsPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { redirectIfAccessTokenExpired } from "@src/lib/nextjs/pageGuards/pageGuards";

export default ReferralsPage;

export const getServerSideProps = defineServerSideProps({
  if: redirectIfAccessTokenExpired,
  route: "/referrals"
});
