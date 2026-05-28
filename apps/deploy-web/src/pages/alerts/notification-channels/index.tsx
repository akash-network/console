import { NotificationChannelsPage } from "@src/components/alerts/NotificationChannelsPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default NotificationChannelsPage;

export const getServerSideProps = defineServerSideProps({
  route: "/alerts/notification-channels",
  if: async ctx => await isFeatureEnabled("alerts", ctx)
});
