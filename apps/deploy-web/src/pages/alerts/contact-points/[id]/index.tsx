import { EditContactPointPage } from "@src/components/alerts/EditContactPointPage";
import { featureFlagService } from "@src/services/feature-flag";

export default EditContactPointPage;

export const getServerSideProps = featureFlagService.showIfEnabled("alerts");
