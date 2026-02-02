import React from "react";

import { DeploymentList } from "@src/components/deployments/DeploymentList";
import OnboardingRedirect from "@src/components/onboarding/OnboardingRedirect/OnboardingRedirect";
import { Guard } from "@src/hoc/guard/guard.hoc";
import { useIsOnboarded } from "@src/hooks/useIsOnboarded";

function DeploymentsPage() {
  return <DeploymentList />;
}

export default Guard(DeploymentsPage, useIsOnboarded, OnboardingRedirect);
