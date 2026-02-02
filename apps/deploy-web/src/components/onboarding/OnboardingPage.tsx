import React, { type FC } from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { LogOut } from "iconoir-react";

import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { useServices } from "@src/context/ServicesProvider";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { OnboardingContainer } from "./OnboardingContainer/OnboardingContainer";
import { OnboardingView } from "./OnboardingView/OnboardingView";

export const OnboardingPage: FC = () => {
  const { analyticsService, authService } = useServices();

  const handleLogout = () => {
    analyticsService.track("onboarding_logout", {
      category: "onboarding"
    });
    authService.logout();
  };

  return (
    <div>
      <CustomNextSeo title="Free Trial Onboarding" url={`${domainName}${UrlService.newSignup()}`} />
      <div className="container mx-auto px-4 py-12">
        <OnboardingContainer>{props => <OnboardingView {...props} />}</OnboardingContainer>

        <div className="py-8 text-center">
          <button className={cn(buttonVariants({ variant: "ghost" }), "inline-flex items-center gap-2")} onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};
