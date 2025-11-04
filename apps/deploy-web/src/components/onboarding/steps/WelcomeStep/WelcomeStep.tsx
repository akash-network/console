"use client";
import React from "react";
import { Button, Card, Progress } from "@akashnetwork/ui/components";
import { InfoCircle, Rocket } from "iconoir-react";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useWalletBalance } from "@src/hooks/useWalletBalance";

interface WelcomeStepProps {
  onComplete: () => void;
}

interface TemplateCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onDeploy: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ icon, title, description, onDeploy }) => (
  <Card className="flex flex-col bg-card">
    <div className="flex flex-1 flex-col p-6">
      <div className="mb-6 flex justify-center">{icon}</div>
      <div className="mb-4 flex-1 space-y-4">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button onClick={onDeploy} className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
        Deploy Now
      </Button>
    </div>
  </Card>
);

export const WelcomeStep: React.FunctionComponent<WelcomeStepProps> = ({ onComplete }) => {
  const { analyticsService } = useServices();
  const { creditAmount } = useWallet();
  const { balance: walletBalance } = useWalletBalance();

  const handleDeployTemplate = (templateName: string) => {
    analyticsService.track("onboarding_completed", {
      category: "onboarding",
      template: templateName,
      action: "deploy_template"
    });
    // TODO: Implement template deployment logic
    onComplete();
  };

  const handleSkip = () => {
    analyticsService.track("onboarding_completed", {
      category: "onboarding",
      action: "skip"
    });
    onComplete();
  };

  console.log("walletBalance", walletBalance);

  // Calculate trial usage for progress bar
  const TRIAL_TOTAL = 100; // $100 total trial credits
  const creditsRemaining = walletBalance?.totalDeploymentGrantsUSD || creditAmount || TRIAL_TOTAL;
  const creditsUsed = TRIAL_TOTAL - creditsRemaining;
  const usagePercentage = Math.min(Math.max((creditsRemaining / TRIAL_TOTAL) * 100, 0), 100);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      {/* Trial Status Bar */}
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="rounded-md bg-green-500/10 px-3 py-1.5">
                <span className="text-sm font-semibold text-green-500">Trial Active</span>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-semibold">Free Trial Credits: ${creditsRemaining.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">
                  Expires on December 3, 2025 <span className="mx-2">•</span> 30 days remaining
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <InfoCircle className="h-4 w-4" />
              <span>Deployments last for maximum 1 day during trial</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={usagePercentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>${creditsUsed.toFixed(2)} used</span>
              <span>
                ${creditsRemaining.toFixed(2)} remaining of ${TRIAL_TOTAL.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Welcome Message */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Welcome to Akash Console</h1>
        <p className="text-lg text-muted-foreground">Choose a template below to launch your first app in minutes.</p>
      </div>

      {/* Template Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <TemplateCard
          icon={<Rocket className="h-16 w-16 text-foreground" />}
          title="Hello Akash!"
          description="A simple web app powered by Next.js, perfect for your first deployment on Akash. View and explore the full source code here."
          onDeploy={() => handleDeployTemplate("hello-akash")}
        />
        <TemplateCard
          icon={<Rocket className="h-16 w-16 text-foreground" />}
          title="ComfyUI"
          description="A powerful, modular Stable Diffusion tool that lets you build and run advanced image workflows using a visual, node-based interface."
          onDeploy={() => handleDeployTemplate("comfyui")}
        />
        <TemplateCard
          icon={<Rocket className="h-16 w-16 text-foreground" />}
          title="Llama-3.1-8b"
          description="A cutting-edge language model built for fast, context-aware text generation. Access a wide range of advanced language tasks."
          onDeploy={() => handleDeployTemplate("llama-3.1-8b")}
        />
      </div>

      {/* Skip Link */}
      <div className="flex justify-center pt-4">
        <button onClick={handleSkip} className="text-muted-foreground transition-colors hover:text-foreground">
          Skip and go to Console
        </button>
      </div>
    </div>
  );
};
