import { UsagePage } from "@src/components/billing-usage/UsagePage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default UsagePage;

export const getServerSideProps = defineServerSideProps({
  route: "/usage"
});
