import { ActivityHistoryPage } from "@src/components/activity/ActivityHistoryPage/ActivityHistoryPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default ActivityHistoryPage;

export const getServerSideProps = defineServerSideProps({
  route: "/activity"
});
