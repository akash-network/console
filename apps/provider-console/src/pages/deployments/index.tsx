import { Deployments } from "@src/components/deployments/Deployments";
import { Layout } from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { withAuth } from "@src/components/shared/withAuth";

const DeploymentsPage: React.FC = () => {
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
};

export default withAuth(DeploymentsPage);
