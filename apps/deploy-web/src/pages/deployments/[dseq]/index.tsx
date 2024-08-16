import { DeploymentDetail } from "@src/components/deployments/DeploymentDetail";

const DeploymentDetailPage: React.FunctionComponent = () => {
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
