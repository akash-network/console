import { Authorizations } from "@src/components/authorizations/Authorizations";
import { Guard } from "@src/hoc/guard/guard.hoc";
import { useIsSelfCustodyAccessible } from "@src/hoc/guard/useIsSelfCustodyAccessible";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isSelfCustodyEnabled } from "@src/lib/nextjs/pageGuards/selfCustody";

const AuthorizationsPage: React.FunctionComponent = () => {
  return <Authorizations />;
};

export default Guard(AuthorizationsPage, useIsSelfCustodyAccessible);

export const getServerSideProps = defineServerSideProps({
  route: "/settings/authorizations",
  if: ctx => isSelfCustodyEnabled(ctx)
});
