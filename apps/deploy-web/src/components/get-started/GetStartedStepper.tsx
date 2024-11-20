"use client";
import React, { useEffect, useState } from "react";
import { MdRestartAlt } from "react-icons/md";
import { Button, buttonVariants, CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import Step from "@mui/material/Step";
import StepContent from "@mui/material/StepContent";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import { Check, HandCard, Rocket, WarningCircle, XmarkCircleSolid } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";

import { TopUpAmountPicker } from "@src/components/top-up-amount-picker/TopUpAmountPicker";
import { LoginRequiredLink } from "@src/components/user/LoginRequiredLink";
import { ConnectManagedWalletButton } from "@src/components/wallet/ConnectManagedWalletButton";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { useChainParam } from "@src/context/ChainParamProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import walletStore from "@src/store/walletStore";
import { RouteStep } from "@src/types/route-steps.type";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { UrlService } from "@src/utils/urlUtils";
import LiquidityModal from "../liquidity-modal";
import { ExternalLink } from "../shared/ExternalLink";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import { QontoConnector, QontoStepIcon } from "./Stepper";

export const GetStartedStepper: React.FunctionComponent = () => {
  const [activeStep, setActiveStep] = useState(0);
  const { isWalletConnected, address, isManaged: isManagedWallet, isTrialing } = useWallet();
  const { refetch: refetchBalances, balance: walletBalance } = useWalletBalance();
  const { minDeposit } = useChainParam();
  const aktBalance = walletBalance ? uaktToAKT(walletBalance.balanceUAKT) : 0;
  const usdcBalance = walletBalance ? udenomToDenom(walletBalance.balanceUUSDC) : 0;
  const [isSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);
  const { user } = useCustomUser();

  useEffect(() => {
    const getStartedStep = localStorage.getItem("getStartedStep");

    if (getStartedStep) {
      const _getStartedStep = parseInt(getStartedStep);
      setActiveStep(_getStartedStep >= 0 && _getStartedStep <= 2 ? _getStartedStep : 0);
    }
  }, []);

  const handleNext = () => {
    setActiveStep(prevActiveStep => {
      const newStep = prevActiveStep + 1;

      localStorage.setItem("getStartedStep", newStep.toString());

      return newStep;
    });
  };

  const handleReset = () => {
    setActiveStep(0);
    localStorage.setItem("getStartedStep", "0");
  };

  const onStepClick = (step: number) => {
    setActiveStep(step);

    localStorage.setItem("getStartedStep", step.toString());
  };

  return (
    <Stepper activeStep={activeStep} orientation="vertical" connector={<QontoConnector />}>
      <Step>
        <StepLabel
          StepIconComponent={QontoStepIcon}
          onClick={() => (activeStep > 0 ? onStepClick(0) : null)}
          classes={{ label: cn("text-xl tracking-tight", { ["cursor-pointer hover:text-primary"]: activeStep > 0, ["!font-bold"]: activeStep === 0 }) }}
        >
          {browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED ? "Trial / Billing" : "Billing"}
        </StepLabel>

        <StepContent>
          {browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED && !isWalletConnected && (
            <p className="text-muted-foreground">
              You can pay using either USD (fiat) or with crypto ($AKT or $USDC). To pay with USD click "Start Trial". To pay with crypto, click "Connect
              Wallet"
            </p>
          )}

          {isWalletConnected && !isManagedWallet && (
            <div className="my-4 flex items-center space-x-2">
              <Check className="text-green-600" />
              <span>Wallet is installed</span>{" "}
            </div>
          )}

          {!isManagedWallet && (
            <p className="text-muted-foreground">
              You need at least {minDeposit.akt} AKT or {minDeposit.usdc} USDC in your wallet to deploy on Akash. If you don't have {minDeposit.akt} AKT or{" "}
              {minDeposit.usdc} USDC, you can switch to the sandbox or ask help in our <ExternalLink href="https://discord.gg/akash" text="Discord" />.
            </p>
          )}

          <div className="my-4 flex items-center space-x-4">
            {isManagedWallet && (
              <TopUpAmountPicker popoverClassName="absolute md:min-w-max">
                <LoginRequiredLink
                  className={cn("hover:no-underline", buttonVariants({ variant: "outline", className: "mr-2 border-primary" }))}
                  href="/api/proxy/v1/checkout"
                  message="Sign In or Sign Up to add funds to your balance"
                >
                  <HandCard className="text-xs text-accent-foreground" />
                  <span className="m-2 whitespace-nowrap text-accent-foreground">Add Funds</span>
                </LoginRequiredLink>
              </TopUpAmountPicker>
            )}
            <Button variant="default" onClick={handleNext}>
              Next
            </Button>
            {!isManagedWallet && (
              <Link className={cn(buttonVariants({ variant: "text" }))} href={UrlService.getStartedWallet()}>
                Learn how
              </Link>
            )}
          </div>

          {isWalletConnected && isTrialing && (
            <div className="my-4 flex items-center space-x-2">
              <Check className="text-green-600" />
              <span>Trialing</span>
            </div>
          )}

          {isWalletConnected && isManagedWallet && !isTrialing && (
            <div className="my-4 flex items-center space-x-2">
              <Check className="text-green-600" />
              <span>Billing is set up</span>
            </div>
          )}

          {!isWalletConnected && (
            <div>
              <div className="my-4 flex items-center space-x-2">
                <XmarkCircleSolid className="text-destructive" />
                <span>Billing is not set up</span>
              </div>

              <div className="flex items-center gap-2">
                {browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED && !isSignedInWithTrial && <ConnectManagedWalletButton className="mr-2 w-full md:w-auto" />}
                <ConnectWalletButton />

                {isSignedInWithTrial && !user && (
                  <Link className={cn(buttonVariants({ variant: "outline" }))} href={UrlService.login()}>
                    Sign in
                  </Link>
                )}
              </div>
            </div>
          )}

          {walletBalance && (
            <div className="my-4 flex items-center space-x-2">
              {aktBalance >= minDeposit.akt || usdcBalance >= minDeposit.usdc ? (
                <Check className="text-green-600" />
              ) : (
                <CustomTooltip
                  title={
                    <>
                      If you don&apos;t have {minDeposit.akt} AKT or {minDeposit.usdc} USDC, you can request authorization for some tokens to get started on our{" "}
                      <ExternalLink href="https://discord.gg/akash" text="Discord" />.
                    </>
                  }
                >
                  <WarningCircle className="text-warning" />
                </CustomTooltip>
              )}
              {isManagedWallet ? (
                <span>
                  You have <strong>${usdcBalance}</strong>
                </span>
              ) : (
                <span>
                  You have <strong>{aktBalance}</strong> AKT and <strong>{usdcBalance}</strong> USDC
                </span>
              )}
              {!isManagedWallet && isWalletConnected && <LiquidityModal address={address} aktBalance={aktBalance} refreshBalances={refetchBalances} />}
            </div>
          )}
        </StepContent>
      </Step>

      <Step>
        <StepLabel
          StepIconComponent={QontoStepIcon}
          onClick={() => onStepClick(1)}
          classes={{
            label: cn("text-xl tracking-tight", {
              ["cursor-pointer hover:text-primary"]: activeStep > 1,
              ["!font-bold"]: activeStep === 1
            })
          }}
        >
          Docker container
        </StepLabel>
        <StepContent>
          <p className="mb-2 text-muted-foreground">
            To deploy on Akash, you need a docker container image as everything runs within Kubernetes. You can make your own or browse through pre-made
            solutions in the marketplace.
          </p>

          <p className="text-muted-foreground">For the sake of getting started, we will deploy a simple Next.js app that you can find in the deploy page.</p>
          <div className="my-4 flex flex-col flex-wrap items-start space-y-4 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0">
            <Button variant="default" onClick={handleNext}>
              Next
            </Button>

            <div>
              <ExternalLink href="https://docs.docker.com/get-started/" text="Learn how" />
            </div>

            <Link href={UrlService.templates()} className={cn("py-4", buttonVariants({ variant: "secondary" }))}>
              Explore Marketplace
            </Link>
          </div>
        </StepContent>
      </Step>

      <Step>
        <StepLabel StepIconComponent={QontoStepIcon} classes={{ label: cn("text-xl tracking-tight", { ["!font-bold"]: activeStep === 2 }) }}>
          Hello world
        </StepLabel>
        <StepContent>
          <p className="text-muted-foreground">
            Deploy your first web app on Akash! This is a simple Next.js app and you can see the{" "}
            <ExternalLink href="https://github.com/akash-network/hello-akash-world" text="source code here" />.
          </p>
          <div className="my-4 space-x-2">
            <Link
              className={cn("space-x-2", buttonVariants({ variant: "default" }))}
              href={UrlService.newDeployment({ templateId: "hello-world", step: RouteStep.editDeployment })}
            >
              <span>Deploy!</span>
              <Rocket className="rotate-45" />
            </Link>

            <Button onClick={handleReset} className="space-x-2" variant="ghost">
              <span>Reset</span>
              <MdRestartAlt />
            </Button>
          </div>
        </StepContent>
      </Step>
    </Stepper>
  );
};
