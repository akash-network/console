import Layout from "@src/components/layout/Layout";
import Deployments from "@src/components/deployments/Deployments";
import { Title } from "@src/components/shared/Title";

export default function DeploymentsPage() {
  return (
    <Layout>
      <div className="flex items-center">
        <div className="w-10 flex-1">
          <Title>Deployments</Title>
        </div>
        <div className="flex-end mr-4 text-center md:h-auto"></div>
      </div>
      <div className="mt-4">
        <Deployments />
      </div>
    </Layout>
  );
}
