import { BillingPage } from "@src/components/usage/BillingPage";
import { RegisteredUsersOnly } from "@src/hoc/registered-users-only/registered-users-only.hoc";
import { routeProtector } from "@src/services/route-protector";

export default RegisteredUsersOnly(BillingPage);

export const getServerSideProps = routeProtector.showToRegisteredUserIfEnabled("usage");
