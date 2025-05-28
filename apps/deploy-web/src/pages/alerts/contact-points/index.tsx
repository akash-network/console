import { ContactPointsPage } from "@src/components/alerts/ContactPointsPage";
import { RegisteredUsersOnly } from "@src/hoc/registered-users-only/registered-users-only.hoc";
import { routeProtector } from "@src/services/route-protector";

export default RegisteredUsersOnly(ContactPointsPage);

export const getServerSideProps = routeProtector.showToRegisteredUserIfEnabled("alerts");
