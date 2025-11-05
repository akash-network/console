"use client";
import React, { useState } from "react";
import Image from "next/image";

import { useServices } from "@src/context/ServicesProvider";
import { TemplateCard } from "./TemplateCard";
import { TrialStatusBar } from "./TrialStatusBar";

interface WelcomeStepProps {
  onComplete: (templateName: string) => Promise<void>;
}

export const WelcomeStep: React.FunctionComponent<WelcomeStepProps> = ({ onComplete }) => {
  const { analyticsService } = useServices();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployingTemplate, setDeployingTemplate] = useState<string | null>(null);

  const handleDeployTemplate = async (templateName: string) => {
    try {
      setIsDeploying(true);
      setDeployingTemplate(templateName);

      analyticsService.track("onboarding_completed", {
        category: "onboarding",
        template: templateName,
        action: "deploy_template"
      });

      await onComplete(templateName);
    } catch (error) {
      setIsDeploying(false);
      setDeployingTemplate(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      {/* Trial Status Bar */}
      <TrialStatusBar />

      {/* Welcome Message */}
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to Akash Console</h1>
        <p className="text-base text-muted-foreground">Choose a template below to launch your first app in minutes.</p>
      </div>

      {/* Template Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <TemplateCard
          icon={<Image src="/images/onboarding/hello_akash.svg" alt="Hello Akash" width={100} height={100} />}
          title="Hello Akash!"
          description="A simple web app powered by Next.js, perfect for your first deployment on Akash. View and explore the full source code here."
          onDeploy={() => handleDeployTemplate("hello-akash")}
          disabled={isDeploying}
          isLoading={deployingTemplate === "hello-akash"}
        />
        <TemplateCard
          icon={<Image src="/images/onboarding/comfy_ui.svg" alt="ComfyUI" width={100} height={100} />}
          title="ComfyUI"
          description="A powerful, modular Stable Diffusion tool that lets you build and run advanced image workflows using a visual, node-based interface."
          onDeploy={() => handleDeployTemplate("comfyui")}
          disabled={isDeploying}
          isLoading={deployingTemplate === "comfyui"}
        />
        <TemplateCard
          icon={<Image src="/images/onboarding/llama.svg" alt="Llama" width={100} height={100} />}
          title="Llama-3.1-8b"
          description="A cutting-edge language model built for fast, context-aware text generation. Access a wide range of advanced language tasks."
          onDeploy={() => handleDeployTemplate("llama-3.1-8b")}
          disabled={isDeploying}
          isLoading={deployingTemplate === "llama-3.1-8b"}
        />
      </div>
    </div>
  );
};
