import { ContactPointsPage } from "@src/components/alerts/ContactPointsPage";
import { featureFlagService } from "@src/services/feature-flag";

export default ContactPointsPage;

export const getServerSideProps = featureFlagService.showIfEnabled("alerts");
