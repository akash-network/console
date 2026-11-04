"use client";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { cn, copyTextToClipboard } from "@akashnetwork/ui/utils";
import { ArrowUpRight, Check, Container, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CreateApiKeyDialog } from "@src/components/api-keys/CreateApiKeyDialog/CreateApiKeyDialog";
import { AKASH_SKILL_INSTALL_COMMAND } from "@src/config/agent-setup.config";
import { useServices } from "@src/context/ServicesProvider";
import { useGetStartedChecklist } from "./useGetStartedChecklist";
import { useGetStartedQuickPicks } from "./useGetStartedQuickPicks";

export const DEPENDENCIES = { useGetStartedChecklist, useGetStartedQuickPicks, useRouter, useServices, CreateApiKeyDialog };

export const AKASHML_URL = "https://playground.akashml.com/?utm_source=akash-console&utm_medium=get-started&utm_campaign=trial-onboarding";

export const API_KEY_SETUP_COMMAND = 'export AKASH_API_KEY="<your-api-key>"';

const COPIED_FEEDBACK_MS = 1500;

type GetStartedStep = "deploy" | "api_key" | "agent";

export function GetStartedChecklist({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const { isVisible, steps, doneCount, stepCount, isComplete, dismiss, markAgentSetupCopied } = d.useGetStartedChecklist();
  const router = d.useRouter();
  const quickPicks = d.useGetStartedQuickPicks();
  const { urlService, analyticsService } = d.useServices();
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  if (!isVisible) return null;

  const trackStepClick = (step: GetStartedStep, option: string) => {
    analyticsService.track("get_started_step_click", { category: "onboarding", step, option });
  };

  const deployTemplate = (templateId: string) => {
    trackStepClick("deploy", templateId);
    router.push(urlService.configureDeployment({ templateId, sdlStrategy: "default", bidStrategy: "auto" }));
  };

  const openCreateKey = () => {
    trackStepClick("api_key", "create_key");
    setIsCreatingKey(true);
  };

  const copyAgentSetup = async (option: "copy_install" | "copy_key_setup", text: string) => {
    trackStepClick("agent", option);
    const isCopied = await copyTextToClipboard(text);
    if (isCopied) markAgentSetupCopied();
    return isCopied;
  };

  return (
    <section aria-labelledby="get-started-title" className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-start gap-4 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <h2 id="get-started-title" className="text-[17px] font-semibold leading-6 tracking-tight text-foreground">
            {isComplete ? "You're set up" : "Get started on Akash"}
          </h2>
          <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
            {isComplete ? "All three steps are done. This card goes away in a moment." : "Stays on your home page until you finish or dismiss it."}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap pt-1 font-mono text-[11px] font-medium leading-4 text-muted-foreground">
          <ProgressRing doneCount={doneCount} total={stepCount} />
          {doneCount} of {stepCount} done
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-1 h-8 w-8 shrink-0 rounded-md text-muted-foreground"
          aria-label="Dismiss Get started"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ol className="grid grid-cols-1 border-t border-border max-md:divide-y max-md:divide-border md:grid-cols-3 md:divide-x md:divide-border">
        <StepColumn number={1} isDone={steps.hasDeployed} title="Deploy your first app" description="Runs on your trial credits.">
          {quickPicks.map(quickPick => (
            <Button
              key={quickPick.templateId}
              variant="outline"
              size="sm"
              className="h-8 rounded-full text-xs"
              onClick={() => deployTemplate(quickPick.templateId)}
            >
              {quickPick.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs no-underline hover:no-underline" asChild>
            <Link href={urlService.configureDeployment({ exampleImage: true })} onClick={() => trackStepClick("deploy", "custom-image")}>
              <Container className="h-3.5 w-3.5" />
              Your image
            </Link>
          </Button>
        </StepColumn>

        <StepColumn number={2} isDone={steps.hasApiKey} title="Create an API key" description="For your scripts, CI or agent.">
          {steps.hasApiKey ? (
            <Button variant="outline" size="sm" className="h-8 text-xs no-underline hover:no-underline" asChild>
              <Link href={urlService.userApiKeys()} onClick={() => trackStepClick("api_key", "manage_keys")}>
                Manage keys
              </Link>
            </Button>
          ) : (
            <Button size="sm" className="h-8 text-xs" onClick={openCreateKey}>
              Create key
            </Button>
          )}
        </StepColumn>

        <StepColumn
          number={3}
          isDone={steps.hasConnectedAgent}
          title="Connect your agent"
          description="Install the Akash skill in Claude Code, Cursor or Codex."
          hint={steps.hasApiKey ? undefined : "Key setup uses the key from step 2."}
        >
          <CopyButton label="Copy install" onCopy={() => copyAgentSetup("copy_install", AKASH_SKILL_INSTALL_COMMAND)} />
          <CopyButton label="Copy key setup" disabled={!steps.hasApiKey} onCopy={() => copyAgentSetup("copy_key_setup", API_KEY_SETUP_COMMAND)} />
        </StepColumn>
      </ol>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border bg-muted/40 px-5 py-3 text-[13px] leading-5">
        <p className="min-w-[240px] flex-1 text-muted-foreground">
          <span className="font-medium text-foreground">Need a bigger model?</span> Llama 3.3 70B, Qwen and GPT OSS 120B run on AkashML as a hosted API. Pay per
          token, no GPU to rent.
        </p>
        <a
          href={AKASHML_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-foreground underline-offset-4 hover:underline"
          onClick={() => analyticsService.track("akashml_link_click", { category: "onboarding", placement: "get_started" })}
        >
          Try AkashML
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {isCreatingKey && <d.CreateApiKeyDialog onClose={() => setIsCreatingKey(false)} />}
    </section>
  );
}

function StepColumn({
  number,
  isDone,
  title,
  description,
  hint,
  children
}: {
  number: number;
  isDone: boolean;
  title: string;
  description: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-3 px-5 py-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs",
            isDone ? "border-foreground bg-foreground text-background" : "border-border bg-muted text-muted-foreground"
          )}
        >
          {isDone ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Done:</span>
            </>
          ) : (
            number
          )}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-6 text-foreground">{title}</h3>
          <p className="text-[13px] leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-9">{children}</div>
      {hint && <p className="pl-9 text-xs text-muted-foreground">{hint}</p>}
    </li>
  );
}

function CopyButton({ label, disabled, onCopy }: { label: string; disabled?: boolean; onCopy: () => Promise<boolean> }) {
  const [isCopied, setIsCopied] = useState(false);
  const resetTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(function clearFeedbackTimerOnUnmount() {
    return function clearFeedbackTimer() {
      clearTimeout(resetTimeout.current);
    };
  }, []);

  const copy = async () => {
    if (!(await onCopy())) return;
    setIsCopied(true);
    clearTimeout(resetTimeout.current);
    resetTimeout.current = setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={disabled} onClick={copy}>
      {isCopied && <Check className="h-3.5 w-3.5" />}
      {isCopied ? "Copied" : label}
    </Button>
  );
}

function ProgressRing({ doneCount, total }: { doneCount: number; total: number }) {
  const radius = 7;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="-rotate-90">
      <circle cx="9" cy="9" r={radius} fill="none" strokeWidth="2.5" className="stroke-border" />
      <circle
        cx="9"
        cy="9"
        r={radius}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - doneCount / total)}
        className="stroke-foreground transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}
