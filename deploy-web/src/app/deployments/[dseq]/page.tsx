import { Metadata, ResolvingMetadata } from "next";
import { DeploymentDetail } from "./DeploymentDetail";

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
  return <DeploymentDetail dseq={dseq} />;
};

export default DeploymentDetailPage;
