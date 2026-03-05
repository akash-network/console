import React, { type FC } from "react";

import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { OnboardingContainer } from "./OnboardingContainer/OnboardingContainer";
import { OnboardingView } from "./OnboardingView/OnboardingView";

export const OnboardingPage: FC = () => {
  return (
    <div className="flex min-h-full flex-col">
      <CustomNextSeo title="Free Trial Onboarding" url={`${domainName}${UrlService.newSignup()}`} />
      <div className="container mx-auto flex-1 px-4 py-12">
        <OnboardingContainer>{props => <OnboardingView {...props} />}</OnboardingContainer>
      </div>
    </div>
  );
};
