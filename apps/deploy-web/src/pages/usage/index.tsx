import { UsagePage } from "@src/components/usage/UsagePage";
import { RegisteredUsersOnly } from "@src/hoc/registered-users-only/registered-users-only.hoc";
import { routeProtector } from "@src/services/route-protector";

export default RegisteredUsersOnly(UsagePage);

export const getServerSideProps = routeProtector.showToRegisteredUserIfEnabled("allowViewingUsage");
