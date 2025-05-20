import { AlertsPage } from "@src/components/alerts/AlertsPage";
import { featureFlagService } from "@src/services/feature-flag";

export default AlertsPage;

export const getServerSideProps = featureFlagService.showIfEnabled("alerts");
