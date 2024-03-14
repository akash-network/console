import { Metadata, ResolvingMetadata } from "next";

interface IDeploymentDetailPageProps {
  params: { dseq: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { dseq } }: IDeploymentDetailPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  return {
    title: `Deployment detail #${dseq}`
  };
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
