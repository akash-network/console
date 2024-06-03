import React from "react";

import { DeploymentList } from "@src/components/deployments/DeploymentList";

function DeploymentsPage() {
  return <DeploymentList />;
}

export default DeploymentsPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}
