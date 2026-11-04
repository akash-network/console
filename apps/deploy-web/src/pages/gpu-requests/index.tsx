import { GpuRequestsPage } from "@src/components/gpu-requests/GpuRequestsPage/GpuRequestsPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default GpuRequestsPage;

export const getServerSideProps = defineServerSideProps({
  route: "/gpu-requests",
  if: context => isFeatureEnabled("gpu_quote_requests", context)
});
