import { ConfirmAccountDeletion } from "@src/components/user/ConfirmAccountDeletion/ConfirmAccountDeletion";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { definePublicPage } from "@src/lib/pages/definePublicPage";

const ConfirmAccountDeletionPage = () => <ConfirmAccountDeletion />;

export default definePublicPage(ConfirmAccountDeletionPage);

export const getServerSideProps = defineServerSideProps({
  route: "/user/confirm-delete",
  public: true
});
