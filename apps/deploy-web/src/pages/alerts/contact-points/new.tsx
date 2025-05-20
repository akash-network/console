import { CreateContactPointPage } from "@src/components/alerts/CreateContactPointPage";
import { featureFlagService } from "@src/services/feature-flag";

export default CreateContactPointPage;

export const getServerSideProps = featureFlagService.showIfEnabled("alerts");
