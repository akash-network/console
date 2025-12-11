import React, { type FC } from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowLeft } from "iconoir-react";
import Link from "next/link";

import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { useServices } from "@src/context/ServicesProvider";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { OnboardingContainer } from "./OnboardingContainer/OnboardingContainer";
import { OnboardingView } from "./OnboardingView/OnboardingView";

export const OnboardingPage: FC = () => {
  const { analyticsService } = useServices();

  const handleBackToConsole = () => {
    analyticsService.track("onboarding_back_to_console", {
      category: "onboarding"
    });
  };

  return (
    <div>
      <CustomNextSeo title="Free Trial Onboarding" url={`${domainName}${UrlService.newSignup()}`} />
      <div className="container mx-auto px-4 py-12">
        <OnboardingContainer>{props => <OnboardingView {...props} />}</OnboardingContainer>

        <div className="py-8 text-center">
          <Link href={UrlService.home()} className={cn(buttonVariants({ variant: "ghost" }), "inline-flex items-center gap-2")} onClick={handleBackToConsole}>
            <NavArrowLeft className="h-4 w-4" />
            Back to Console
          </Link>
        </div>
      </div>
    </div>
  );
};
