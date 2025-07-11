import { CreateNotificationChannelPage } from "@src/components/alerts/CreateNotificationChannelPage";
import { RegisteredUsersOnly } from "@src/hoc/registered-users-only/registered-users-only.hoc";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default RegisteredUsersOnly(CreateNotificationChannelPage);

export const getServerSideProps = defineServerSideProps({
  route: "/alerts/notification-channels/new",
  if: async ctx => (await isAuthenticated(ctx)) && (await isFeatureEnabled("alerts", ctx))
});
