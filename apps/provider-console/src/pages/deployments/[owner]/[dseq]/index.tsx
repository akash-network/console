import { DeploymentDetails } from "@src/components/deployments/DeploymentDetails";
import { Layout } from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { withAuth } from "@src/components/shared/withAuth";

type Props = {
  dseq: string;
  owner: string;
};

const DeploymentDetailPage: React.FC<Props> = ({ dseq, owner }) => {
  return (
    <Layout>
      <div className="flex items-center">
        <div className="w-10 flex-1">
          <Title>Deployment Details</Title>
        </div>
        <div className="flex-end mr-4 text-center md:h-auto"></div>
      </div>
      <div className="mt-4">
        <DeploymentDetails dseq={dseq} owner={owner} />
      </div>
    </Layout>
  );
};

export default withAuth(DeploymentDetailPage);

export async function getServerSideProps({ params }) {
  return {
    props: {
      owner: params?.owner,
      dseq: params?.dseq
    }
  };
}
