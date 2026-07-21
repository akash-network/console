import { ConfigureDeployment } from "@src/components/deployments/ConfigureDeployment/ConfigureDeployment/ConfigureDeployment";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default ConfigureDeployment;

export const getServerSideProps = defineServerSideProps({
  route: "/new-deployment/configure"
});
