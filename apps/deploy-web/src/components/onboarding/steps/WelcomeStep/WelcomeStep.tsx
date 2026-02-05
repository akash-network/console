"use client";
import React, { useState } from "react";
import { Button, Spinner } from "@akashnetwork/ui/components";
import { ArrowRight } from "iconoir-react";
import Image from "next/image";

import { useServices } from "@src/context/ServicesProvider";
import { useReturnTo } from "@src/hooks/useReturnTo";
import { TemplateCard } from "./TemplateCard";
import { TrialStatusBar } from "./TrialStatusBar";

interface WelcomeStepProps {
  onComplete: (templateName?: string) => Promise<void>;
}

export const WelcomeStep: React.FunctionComponent<WelcomeStepProps> = ({ onComplete }) => {
  const { analyticsService } = useServices();
  const { isDeploymentReturnTo } = useReturnTo();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployingTemplate, setDeployingTemplate] = useState<string | null>(null);

  const deployTemplate = async (templateName: string) => {
    try {
      setIsDeploying(true);
      setDeployingTemplate(templateName);

      analyticsService.track("onboarding_completed", {
        category: "onboarding",
        template: templateName,
        action: "deploy_template"
      });

      await onComplete(templateName);
    } finally {
      setIsDeploying(false);
      setDeployingTemplate(null);
    }
  };

  const goToDeployment = async () => {
    try {
      setIsDeploying(true);

      analyticsService.track("onboarding_completed", {
        category: "onboarding",
        action: "continue_with_deployment"
      });

      await onComplete();
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <TrialStatusBar />

      {isDeploymentReturnTo ? (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">Welcome to Akash Console</h1>
            <p className="text-base text-muted-foreground">You&apos;re all set! Continue to complete your deployment.</p>
          </div>
          <Button onClick={goToDeployment} disabled={isDeploying} className="gap-2 bg-primary px-8 py-6 text-lg text-primary-foreground hover:bg-primary/90">
            {isDeploying ? (
              <Spinner size="small" />
            ) : (
              <>
                Go to Deployment <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">Welcome to Akash Console</h1>
            <p className="text-base text-muted-foreground">Choose a template below to launch your first app in seconds.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <TemplateCard
              icon={<Image src="/images/onboarding/hello_akash.svg" alt="Hello Akash" width={100} height={100} />}
              title="Hello Akash!"
              description={
                <>
                  A simple web app powered by Next.js, perfect for your first deployment on Akash. View and explore the full source code{" "}
                  <a
                    href="https://github.com/akash-network/hello-akash-world"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    here
                  </a>
                  .
                </>
              }
              onDeploy={() => deployTemplate("hello-akash")}
              disabled={isDeploying}
              isLoading={deployingTemplate === "hello-akash"}
            />
            <TemplateCard
              icon={<Image src="/images/onboarding/comfy_ui.svg" alt="ComfyUI" width={100} height={100} />}
              title="ComfyUI"
              description="A powerful, modular Stable Diffusion tool that lets you build and run advanced image workflows using a visual, node-based interface."
              onDeploy={() => deployTemplate("comfyui")}
              disabled={isDeploying}
              isLoading={deployingTemplate === "comfyui"}
            />
            <TemplateCard
              icon={<Image src="/images/onboarding/llama.svg" alt="Llama" width={100} height={100} />}
              title="Llama-3.1-8b"
              description="A cutting-edge language model built for fast, context-aware text generation. Access a wide range of advanced language tasks."
              onDeploy={() => deployTemplate("llama-3.1-8b")}
              disabled={isDeploying}
              isLoading={deployingTemplate === "llama-3.1-8b"}
            />
          </div>
          <div className="flex justify-center">
            <Button variant="link" size="sm" onClick={goToDeployment} disabled={isDeploying} className="gap-1 text-xs text-muted-foreground">
              {isDeploying ? (
                <Spinner size="small" />
              ) : (
                <>
                  Go to Console <ArrowRight className="h-3 w-3" />
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
