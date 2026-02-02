import React, { type FC, useEffect, useState } from "react";
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
  const [isLoginVisible, setIsLoginVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoginVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = () => {
    analyticsService.track("onboarding_logout", {
      category: "onboarding"
    });
    authService.logout();
  };

  return (
    <div className="flex min-h-full flex-col">
      <CustomNextSeo title="Free Trial Onboarding" url={`${domainName}${UrlService.newSignup()}`} />
      <div className="container mx-auto flex-1 px-4 py-12">
        <OnboardingContainer>{props => <OnboardingView {...props} />}</OnboardingContainer>
      </div>

      <div className={cn("pb-4 text-center transition-opacity duration-500", isLoginVisible ? "opacity-100" : "opacity-0")}>
        <button
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex items-center gap-1.5 text-xs text-muted-foreground")}
          onClick={handleLogout}
        >
          <LogOut className="h-3 w-3" />
          Logout
        </button>
      </div>
    </div>
  );
};
