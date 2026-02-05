import { NewDeploymentContainer } from "@src/components/new-deployment/NewDeploymentContainer/NewDeploymentContainer";
import { createServerSideProps } from "@src/components/new-deployment/NewDeploymentPage/createServerSideProps";
import OnboardingRedirect from "@src/components/onboarding/OnboardingRedirect/OnboardingRedirect";
import { withSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import { Guard } from "@src/hoc/guard/guard.hoc";
import { useIsOnboarded } from "@src/hooks/useIsOnboarded";

export default Guard(withSdlBuilder()(NewDeploymentContainer), useIsOnboarded, OnboardingRedirect);

export const getServerSideProps = createServerSideProps("/new-deployment");
