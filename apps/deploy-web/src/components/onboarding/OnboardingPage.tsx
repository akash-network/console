import React, { type FC } from "react";

import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { OnboardingContainer } from "./OnboardingContainer/OnboardingContainer";
import { OnboardingView } from "./OnboardingView/OnboardingView";

export const OnboardingPage: FC = () => {
  return (
    <div>
      <CustomNextSeo title="Free Trial Onboarding" url={`${domainName}${UrlService.signup()}`} />
      <div className="container mx-auto px-4 py-12">
        <OnboardingContainer>{props => <OnboardingView {...props} />}</OnboardingContainer>
      </div>
    </div>
  );
};
