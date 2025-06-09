import { CreateNotificationChannelPage } from "@src/components/alerts/CreateNotificationChannelPage";
import { RegisteredUsersOnly } from "@src/hoc/registered-users-only/registered-users-only.hoc";
import { routeProtector } from "@src/services/route-protector";

export default RegisteredUsersOnly(CreateNotificationChannelPage);

export const getServerSideProps = routeProtector.showToRegisteredUserIfEnabled("alerts");
