import { CreateNotificationChannelPage } from "@src/components/alerts/CreateNotificationChannelPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default CreateNotificationChannelPage;

export const getServerSideProps = defineServerSideProps({
  route: "/alerts/notification-channels/new"
});
