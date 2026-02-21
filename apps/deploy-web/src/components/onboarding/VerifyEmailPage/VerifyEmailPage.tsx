import React, { useCallback, useState } from "react";
import { AutoButton } from "@akashnetwork/ui/components";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { ArrowRight } from "iconoir-react";
import { useSearchParams } from "next/navigation";
import { NextSeo } from "next-seo";

import Layout, { Loading } from "@src/components/layout/Layout";
import { OnboardingStepIndex } from "@src/components/onboarding/OnboardingContainer/OnboardingContainer";
import { useWhen } from "@src/hooks/useWhen";
import { useVerifyEmail } from "@src/queries/useVerifyEmailQuery";
import { ONBOARDING_STEP_KEY } from "@src/services/storage/keys";
import { UrlService } from "@src/utils/urlUtils";

const DEPENDENCIES = {
  useSearchParams,
  useVerifyEmail,
  useWhen,
  Layout,
  Loading,
  UrlService
};

type VerifyEmailPageProps = {
  dependencies?: typeof DEPENDENCIES;
};

type VerificationResultProps = {
  isVerified: boolean;
  dependencies: Pick<typeof DEPENDENCIES, "UrlService">;
};

function VerificationResult({ isVerified, dependencies: d }: VerificationResultProps) {
  const gotoOnboarding = useCallback(() => {
    window.localStorage?.setItem(ONBOARDING_STEP_KEY, OnboardingStepIndex.PAYMENT_METHOD.toString());
    window.location.href = d.UrlService.onboarding({ returnTo: "/" });
  }, [d.UrlService]);

  return (
    <div className="mt-10 text-center">
      {isVerified ? (
        <>
          <CheckCircleIcon className="mb-2 h-16 w-16 text-green-500" />
          <h5>
            Your email was verified.
            <br />
            You can continue using the application.
          </h5>
          <AutoButton
            onClick={gotoOnboarding}
            text={
              <>
                Continue <ArrowRight className="ml-4" />
              </>
            }
            timeout={5000}
          />
        </>
      ) : (
        <>
          <ErrorOutlineIcon className="mb-2 h-16 w-16 text-red-500" />
          <h5>Your email was not verified. Please try again.</h5>
        </>
      )}
    </div>
  );
}

export function VerifyEmailPage({ dependencies: d = DEPENDENCIES }: VerifyEmailPageProps) {
  const email = d.useSearchParams().get("email");
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const { mutate: verifyEmail, isPending: isVerifying } = d.useVerifyEmail({ onSuccess: setIsVerified, onError: () => setIsVerified(false) });

  d.useWhen(email, () => {
    if (email) {
      verifyEmail(email);
    }
  });

  return (
    <d.Layout>
      <NextSeo title="Verifying your email" />
      {isVerifying ? (
        <d.Loading text="Just a moment while we finish verifying your email." />
      ) : (
        <>
          <VerificationResult isVerified={isVerified === true} dependencies={d} />
        </>
      )}
    </d.Layout>
  );
}
