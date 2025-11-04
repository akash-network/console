"use client";
import React from "react";
import { Button, Card } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { useServices } from "@src/context/ServicesProvider";

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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      {/* Trial Status Bar */}
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-6">
            <div className="rounded-md bg-green-500/10 px-3 py-1.5">
              <span className="text-sm font-semibold text-green-500">Trial Active</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-semibold">Free Trial Credits: $100.00</div>
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
      </Card>

      {/* Welcome Message */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Welcome to Akash Console</h1>
        <p className="text-lg text-muted-foreground">Choose a template below to launch your first app in minutes.</p>
      </div>

      {/* Template Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <TemplateCard
          icon={
            <svg className="h-16 w-16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="12" cy="8" rx="4" ry="6" fill="currentColor" className="text-foreground" />
              <circle cx="12" cy="18" r="3" fill="currentColor" className="text-foreground" />
            </svg>
          }
          title="Hello Akash!"
          description="A simple web app powered by Next.js, perfect for your first deployment on Akash. View and explore the full source code here."
          onDeploy={() => handleDeployTemplate("hello-akash")}
        />
        <TemplateCard
          icon={
            <svg className="h-16 w-16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="8" r="4" fill="currentColor" className="text-foreground" />
              <circle cx="16" cy="8" r="4" fill="currentColor" className="text-foreground" />
              <path d="M8 12L16 8" stroke="currentColor" strokeWidth="2" className="text-foreground" />
              <circle cx="16" cy="8" r="1.5" fill="currentColor" className="text-background" />
              <line x1="15" y1="7" x2="17" y2="7" stroke="currentColor" strokeWidth="1.5" className="text-background" />
            </svg>
          }
          title="ComfyUI"
          description="A powerful, modular Stable Diffusion tool that lets you build and run advanced image workflows using a visual, node-based interface."
          onDeploy={() => handleDeployTemplate("comfyui")}
        />
        <TemplateCard
          icon={
            <svg className="h-16 w-16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="4" r="2" fill="currentColor" className="text-foreground" />
              <path d="M12 6L12 10" stroke="currentColor" strokeWidth="2" className="text-foreground" />
              <path d="M12 10L8 13" stroke="currentColor" strokeWidth="2" className="text-foreground" />
              <path d="M12 10L16 13" stroke="currentColor" strokeWidth="2" className="text-foreground" />
              <path d="M8 13L8 16" stroke="currentColor" strokeWidth="2" className="text-foreground" />
              <path d="M16 13L16 16" stroke="currentColor" strokeWidth="2" className="text-foreground" />
              <path d="M8 16L10 20" stroke="currentColor" strokeWidth="2" className="text-foreground" />
              <path d="M16 16L14 20" stroke="currentColor" strokeWidth="2" className="text-foreground" />
            </svg>
          }
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
