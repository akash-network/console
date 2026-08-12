import { AlertsPage } from "@src/components/alerts/AlertsPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default AlertsPage;

export const getServerSideProps = defineServerSideProps({
  route: "/alerts"
});
