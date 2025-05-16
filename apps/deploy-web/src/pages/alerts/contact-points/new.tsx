import { CreateContactPointPage } from "@src/components/alerts/CreateContactPointPage";
import { showIfEnabled } from "@src/services/feature-flag/feature-flag.service";

export default CreateContactPointPage;

export const getServerSideProps = showIfEnabled("alerts");
