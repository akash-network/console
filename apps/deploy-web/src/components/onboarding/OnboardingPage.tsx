import React, { type FC } from "react";

import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { OnboardingContainer } from "./OnboardingContainer/OnboardingContainer";

export const OnboardingPage: FC = () => {
  return (
    <div>
      <CustomNextSeo title="Free Trial" url={`${domainName}${UrlService.signup()}`} />
      <div className="container mx-auto px-4 py-12">
        <OnboardingContainer />
      </div>
    </div>
  );
};
