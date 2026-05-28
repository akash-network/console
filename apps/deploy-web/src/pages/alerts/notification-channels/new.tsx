import { CreateNotificationChannelPage } from "@src/components/alerts/CreateNotificationChannelPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default CreateNotificationChannelPage;

export const getServerSideProps = defineServerSideProps({
  route: "/alerts/notification-channels/new",
  if: async ctx => await isFeatureEnabled("alerts", ctx)
});
