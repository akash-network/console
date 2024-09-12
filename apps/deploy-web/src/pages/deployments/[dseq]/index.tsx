import { DeploymentDetail } from "@src/components/deployments/DeploymentDetail";

type Props = {
  dseq: string;
};

const DeploymentDetailPage: React.FunctionComponent<Props> = () => {
  return <DeploymentDetail />;
};

export default DeploymentDetailPage;

// export async function getServerSideProps({ params }) {
//   return {
//     props: {
//       dseq: params?.dseq
//     }
//   };
// }
