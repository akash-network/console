"use client";
import React, { useEffect, useState } from "react";
import { MdRestartAlt } from "react-icons/md";
import { Button, buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import Step from "@mui/material/Step";
import StepContent from "@mui/material/StepContent";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import { Check, XmarkCircleSolid } from "iconoir-react";
import Link from "next/link";

import { useWallet } from "@src/context/WalletProvider";
import { UrlService } from "@src/utils/urlUtils";
import { WalletStatus } from "../layout/WalletStatus";
import { QontoConnector, QontoStepIcon } from "./Stepper";

export const GetStartedStepper: React.FunctionComponent = () => {
  const [activeStep, setActiveStep] = useState(0);
  const { isWalletConnected } = useWallet();

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
          Funding Requirements
        </StepLabel>

        <StepContent>
          <p>To begin the process, ensure you have at least 5 AKT tokens in your wallet.</p>
          <ul className="list-inside list-disc">
            <li>Every lease created on the Akash network requires 5 AKT to be locked in escrow.</li>
            <li>These tokens are returned when the lease is closed.</li>
            <li>Verify your wallet balance and fund it if necessary.</li>
          </ul>
          {isWalletConnected && (
            <div className="my-4 flex items-center space-x-2">
              <Check className="text-green-600" />
              <span>Wallet is installed</span>{" "}
            </div>
          )}

          {!isWalletConnected && (
            <div>
              <div className="my-4 flex items-center space-x-2">
                <XmarkCircleSolid className="text-destructive" />
                <span>Wallet is not connected</span>
              </div>
              <div className="my-4">
                <WalletStatus />
              </div>
            </div>
          )}
          <div className="my-4 flex items-center space-x-4">
            {isWalletConnected && (
              <Button variant="default" onClick={handleNext}>
                Next
              </Button>
            )}

            <Link className={cn(buttonVariants({ variant: "text" }))} href={UrlService.getStartedWallet()}>
              Learn how
            </Link>
          </div>
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
          Basic Provider Requirements
        </StepLabel>
        <StepContent>
          <p>To operate as an Akash provider, you must meet the following hardware and network requirements:</p>
          <ol className="list-inside list-decimal">
            <li className="pt-4">
              <span className="font-medium">Server Setup:</span>
              <ul className="list-inside list-disc">
                <li>At least 1 server with a high-speed internet connection.</li>
                <li> For multiple servers, ensure they are connected locally.</li>
              </ul>
            </li>
            <li className="pt-4">
              <span className="font-medium">Minimum Specifications for Each Server</span>
              <ul className="list-inside list-disc">
                <li>8 CPUs</li>
                <li>16 GB RAM</li>
                <li>100 GB Storage</li>
              </ul>
            </li>
            <li className="pt-4">
              <span className="font-medium">Network Configuration:</span>
              <ul className="list-inside list-disc">
                <li>Open the following ports on all servers: 8443, 8444, 80, 443, 6443.</li>
                <li>The server should allow SSH connections from public IPs (ensure the SSH port is open).</li>
              </ul>
            </li>
            <li className="pt-4">
              <span className="font-medium">Access Requirements</span>
              <ul className="list-inside list-disc">
                <li>Root access should be enabled for better compatibility.</li>
              </ul>
            </li>
          </ol>
          <div className="my-4 flex items-center space-x-4">
            <Button variant="default" onClick={handleNext}>
              Confirm Provider Requirements
            </Button>
          </div>
        </StepContent>
      </Step>

      <Step>
        <StepLabel StepIconComponent={QontoStepIcon} classes={{ label: cn("text-xl tracking-tight", { ["!font-bold"]: activeStep === 2 }) }}>
          Provider Configuration
        </StepLabel>
        <StepContent>
          <p>A proper configuration ensures smooth communication between your server and the Akash</p>
          <ol className="list-inside list-decimal">
            <li className="pt-4">
              <span className="font-medium">Domain Name</span>
              <ul className="list-inside list-disc">
                <li>Obtain a domain name and point it to the IP address of your primary server.</li>
              </ul>
            </li>
            <li className="pt-4">
              <span className="font-medium">Organization Information</span>
              <ul className="list-inside list-disc">
                <li>Decide on an organization name.</li>
              </ul>
            </li>
            <li className="pt-4">
              <span className="font-medium">Email Address (Optional)</span>
              <ul className="list-inside list-disc">
                <li>Email address for notifications and updates.</li>
              </ul>
            </li>
          </ol>
          <div className="my-4 flex items-center space-x-4">
            <Button variant="default" onClick={handleNext}>
              Confirm Provider Requirements
            </Button>
          </div>
        </StepContent>
      </Step>

      <Step>
        <StepLabel StepIconComponent={QontoStepIcon} classes={{ label: cn("text-xl tracking-tight", { ["!font-bold"]: activeStep === 2 }) }}>
          Provider Attributes
        </StepLabel>
        <StepContent>
          <p>Provider attributes help tenants discover your provider and make bidding decisions</p>
          <ul className="list-inside list-disc">
            <li className="pt-4">Define attributes such as region, specializations, or hardware capabilities.</li>
            <li className="pt-4">Adding more attributes improves your chances of receiving bids from tenants.</li>
          </ul>
          <div className="my-4 flex items-center space-x-4">
            <Button variant="default" onClick={handleNext}>
              Next
            </Button>
          </div>
        </StepContent>
      </Step>
      <Step>
        <StepLabel StepIconComponent={QontoStepIcon} classes={{ label: cn("text-xl tracking-tight", { ["!font-bold"]: activeStep === 2 }) }}>
          Setting Pricing
        </StepLabel>
        <StepContent>
          <p>Determine the pricing for your resources</p>
          <ul className="list-inside list-disc">
            <li className="pt-4">Specify rates for GPU, CPU, RAM, and storage based on your cost structure and desired profit margins.</li>
            <li className="pt-4">Competitive pricing increases the likelihood of receiving tenant deployments.</li>
          </ul>
          <div className="my-4 flex items-center space-x-4">
            <Button variant="default" onClick={handleNext}>
              Next
            </Button>
          </div>
        </StepContent>
      </Step>

      <Step>
        <StepLabel StepIconComponent={QontoStepIcon} classes={{ label: cn("text-xl tracking-tight", { ["!font-bold"]: activeStep === 2 }) }}>
          Wallet Import
        </StepLabel>
        <StepContent>
          <p>To enable earnings from tenant deployments, you need to import your wallet</p>
          <ol className="list-inside list-decimal">
            <li className="pt-4">
              <span className="font-medium">Auto Mode</span>
              <ul className="list-inside list-disc">
                <li>Securely import your wallet using end-to-end encryption.</li>
                <li>Enter your wallet seed phrase during the process.</li>
              </ul>
            </li>
            <li className="pt-4">
              <span className="font-medium">Manual Mode</span>
              <ul className="list-inside list-disc">
                <li>Follow a series of CLI commands to manually import the wallet into the control node.</li>
              </ul>
            </li>
          </ol>
          <p>Once you understand the process, you can create a provider.</p>
          <div className="my-4 flex items-center space-x-4">
            <div className="my-4 space-x-2">
              <Link className={cn("space-x-2", buttonVariants({ variant: "default" }))} href={UrlService.becomeProvider()}>
                <span>Create Provider</span>
              </Link>
              <Button onClick={handleReset} className="space-x-2" variant="ghost">
                <span>Reset</span>
                <MdRestartAlt />
              </Button>
            </div>
          </div>
        </StepContent>
      </Step>
    </Stepper>
  );
};
