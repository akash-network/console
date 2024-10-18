import Layout from "@src/components/layout/Layout";
import DeploymentDetails from "@src/components/deployments/DeploymentDetails";
import { Title } from "@src/components/shared/Title";

type Props = {
  dseq: string;
  owner: string;
};

const DeploymentDetailPage: React.FunctionComponent<Props> = ({ dseq, owner }) => {
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

export default DeploymentDetailPage;

export async function getServerSideProps({ params }) {
  console.log(params);
  return {
    props: {
      owner: params?.owner,
      dseq: params?.dseq
    }
  };
}
