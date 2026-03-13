/* v8 ignore start */

import { ApiKeysPage } from "@src/components/api-keys/ApiKeysPage/ApiKeysPage";
import { Guard } from "@src/hoc/guard/guard.hoc";
import { useIsRegisteredUser } from "@src/hooks/useUser";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { redirectIfAccessTokenExpired } from "@src/lib/nextjs/pageGuards/pageGuards";

export default Guard(ApiKeysPage, useIsRegisteredUser);

export const getServerSideProps = defineServerSideProps({
  if: redirectIfAccessTokenExpired,
  route: "/user/api-keys"
});
