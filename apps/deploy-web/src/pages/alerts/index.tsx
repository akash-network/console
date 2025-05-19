import { AlertsPage } from "@src/components/alerts/AlertsPage";
import { showIfEnabled } from "@src/services/feature-flag/feature-flag.service";

export default AlertsPage;

export const getServerSideProps = showIfEnabled("alerts");
