"use client";
import React from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { Check, Cloud, Dollar, Rocket, Server } from "iconoir-react";
import Link from "next/link";

import { AkashLogo } from "@src/components/layout/AkashLogo";
import { Title } from "@src/components/shared/Title";
import { UrlService } from "@src/utils/urlUtils";

const benefits = [
  {
    icon: <Rocket className="h-6 w-6" aria-hidden="true" />,
    title: "Start Deploying in Minutes",
    description: "Get your applications running on Akash Network with our streamlined deployment process."
  },
  {
    icon: <Cloud className="h-6 w-6" aria-hidden="true" />,
    title: "Access to Global Infrastructure",
    description: "Deploy across a worldwide network of providers with competitive pricing."
  },
  {
    icon: <Server className="h-6 w-6" aria-hidden="true" />,
    title: "Full Control",
    description: "Complete control over your deployments with advanced configuration options."
  },
  {
    icon: <Dollar className="h-6 w-6" aria-hidden="true" />,
    title: "Pay-as-you-go",
    description: "Only pay for what you use with transparent pricing and no hidden fees."
  }
];

interface FreeTrialLandingStepProps {
  onStartTrial: () => void;
}

export const FreeTrialLandingStep: React.FunctionComponent<FreeTrialLandingStepProps> = ({ onStartTrial }) => {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="mb-8 flex justify-center">
          <AkashLogo />
        </div>
        <Title className="mb-6">Start Your Free Trial</Title>
        <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
          Experience the power of decentralized cloud computing with Akash Network. Deploy your applications on a global network of providers with our free
          trial.
        </p>

        <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" className="px-8 py-4 text-lg" onClick={onStartTrial}>
            Start Free Trial
          </Button>
        </div>

        <div className="mb-8 text-center">
          <p className="text-xs text-muted-foreground">
            By starting your free trial, you agree to our{" "}
            <Link href={UrlService.termsOfService()} className="text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href={UrlService.privacyPolicy()} className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>

        <div className="mx-auto max-w-2xl rounded-lg bg-muted/50 p-6">
          <ul className="space-y-2 text-left" role="list" aria-label="Free trial benefits">
            <li className="flex items-center gap-2" role="listitem">
              <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
              <span>100$ of free credits</span>
            </li>
            <li className="flex items-center gap-2" role="listitem">
              <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
              <span>30 days of free credits</span>
            </li>
            <li className="flex items-center gap-2" role="listitem">
              <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
              <span>Deployments last up to 24 hours</span>
            </li>
            <li className="flex items-center gap-2" role="listitem">
              <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
              <span>Keep unused free credits if you purchase credits</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        <h2 className="mb-12 text-center text-3xl font-bold">Why Choose Akash Console?</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2" role="list" aria-label="Benefits of Akash Console">
          {benefits.map((benefit, index) => (
            <Card key={index} className="h-full" role="listitem" aria-labelledby={`benefit-title-${index}`}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary" aria-hidden="true">
                    {benefit.icon}
                  </div>
                  <CardTitle id={`benefit-title-${index}`} className="text-lg">
                    {benefit.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">{benefit.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
