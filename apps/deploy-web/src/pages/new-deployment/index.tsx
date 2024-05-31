import { NewDeploymentContainer } from "@src/components/new-deployment/NewDeploymentContainer";

function NewDeploymentPage() {
  return <NewDeploymentContainer />;
}

export default NewDeploymentPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}
