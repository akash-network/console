import { NotificationChannelsPage } from "@src/components/alerts/NotificationChannelsPage";
import { RegisteredUsersOnly } from "@src/hoc/registered-users-only/registered-users-only.hoc";
import { routeProtector } from "@src/services/route-protector";

export default RegisteredUsersOnly(NotificationChannelsPage);

export const getServerSideProps = routeProtector.showToRegisteredUserIfEnabled("alerts");
