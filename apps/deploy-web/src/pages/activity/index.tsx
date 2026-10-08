import { ActivityHistoryPage } from "@src/components/activity/ActivityHistoryPage/ActivityHistoryPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default ActivityHistoryPage;

export const getServerSideProps = defineServerSideProps({
  route: "/activity",
  if: context => isFeatureEnabled("notifications_activity_center", context)
});
