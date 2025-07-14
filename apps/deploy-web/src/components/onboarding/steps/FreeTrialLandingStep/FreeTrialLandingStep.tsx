"use client";
import React from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { Check, Cloud, Dollar, Rocket, Server, Shield } from "iconoir-react";

import { Title } from "@src/components/shared/Title";

const benefits = [
  {
    icon: <Rocket className="h-6 w-6" />,
    title: "Start Deploying in Minutes",
    description: "Get your applications running on Akash Network with our streamlined deployment process."
  },
  {
    icon: <Cloud className="h-6 w-6" />,
    title: "Access to Global Infrastructure",
    description: "Deploy across a worldwide network of providers with competitive pricing."
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Secure & Reliable",
    description: "Enterprise-grade security with built-in redundancy and monitoring."
  },
  {
    icon: <Server className="h-6 w-6" />,
    title: "Full Control",
    description: "Complete control over your deployments with advanced configuration options."
  },
  {
    icon: <Dollar className="h-6 w-6" />,
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
      {/* Hero Section */}
      <div className="text-center">
        <Title className="mb-6">Start Your Free Trial</Title>
        <p className="mx-auto mb-8 max-w-3xl text-xl text-muted-foreground">
          Experience the power of decentralized cloud computing with Akash Network. Deploy your applications on a global network of providers with our free
          trial.
        </p>

        <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" className="px-8 py-4 text-lg" onClick={onStartTrial}>
            Start Free Trial
          </Button>
        </div>

        <div className="mx-auto max-w-2xl rounded-lg bg-muted/50 p-6">
          <h3 className="mb-2 text-lg font-semibold">What&apos;s Included in Your Free Trial:</h3>
          <ul className="space-y-2 text-left">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span>Up to 5 deployments</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span>Access to trial providers</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span>Full SDL Builder access</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span>Community support</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Benefits Section */}
      <div>
        <h2 className="mb-12 text-center text-3xl font-bold">Why Choose Akash Console?</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => (
            <Card key={index} className="h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">{benefit.icon}</div>
                  <CardTitle className="text-lg">{benefit.title}</CardTitle>
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
