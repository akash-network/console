import { AlertsPage } from "@src/components/alerts/AlertsPage";
import { RegisteredUsersOnly } from "@src/hoc/registered-users-only/registered-users-only.hoc";
import { routeProtector } from "@src/services/route-protector";

export default RegisteredUsersOnly(AlertsPage);

export const getServerSideProps = routeProtector.showToRegisteredUserIfEnabled("alerts");
