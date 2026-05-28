/* v8 ignore start */

import { ApiKeysPage } from "@src/components/api-keys/ApiKeysPage/ApiKeysPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { redirectIfAccessTokenExpired } from "@src/lib/nextjs/pageGuards/pageGuards";

export default ApiKeysPage;

export const getServerSideProps = defineServerSideProps({
  if: redirectIfAccessTokenExpired,
  route: "/user/api-keys"
});
