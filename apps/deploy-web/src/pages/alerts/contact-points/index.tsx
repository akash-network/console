import { ContactPointsPage } from "@src/components/alerts/ContactPointsPage";
import { showIfEnabled } from "@src/services/feature-flag/feature-flag.service";

export default ContactPointsPage;

export const getServerSideProps = showIfEnabled("alerts");
