
interface IDeploymentDetailPageProps {
  params: { dseq: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

const DeploymentDetailPage: React.FunctionComponent<IDeploymentDetailPageProps> = ({ params: { dseq } }) => {
  return (
    <div>TODO</div>
    // <DeploymentDetail dseq={dseq} />
  );
};

export default DeploymentDetailPage;

export async function getServerSideProps({ params }) {
  return {
    props: {
      dseq: params?.dseq
    }
  };
}
