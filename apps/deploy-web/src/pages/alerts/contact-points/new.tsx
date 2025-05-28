import { CreateContactPointPage } from "@src/components/alerts/CreateContactPointPage";
import { RegisteredUsersOnly } from "@src/hoc/registered-users-only/registered-users-only.hoc";
import { routeProtector } from "@src/services/route-protector";

export default RegisteredUsersOnly(CreateContactPointPage);

export const getServerSideProps = routeProtector.showToRegisteredUserIfEnabled("alerts");
