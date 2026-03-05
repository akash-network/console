import { useEffect } from "react";
import { useRouter } from "next/router";

import { Loading } from "@src/components/layout/Layout";
import { UrlService } from "@src/utils/urlUtils";

const OnboardingRedirect = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace(UrlService.onboarding({ returnTo: router.asPath }));
  }, [router]);

  return <Loading text="Redirecting to onboarding..." />;
};

export default OnboardingRedirect;
