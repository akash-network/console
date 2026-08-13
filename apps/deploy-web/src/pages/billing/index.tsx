import { BillingPage } from "@src/components/billing-usage/BillingPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default BillingPage;

export const getServerSideProps = defineServerSideProps({
  route: "/billing"
});
