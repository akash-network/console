"use client";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { cn, copyTextToClipboard } from "@akashnetwork/ui/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ArrowUpRight, Braces, Check, ChevronDown, ChevronUp, Container, Copy, KeyRound, Rocket, Sparkles, Terminal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useOnboardingApiKey } from "@src/components/onboarding-picker/ApiKeySetup/useOnboardingApiKey";
import { AI_AGENTS_DOCS_URL, AKASH_SKILL_INSTALL_COMMAND, AKT_DOCS_URL, API_REFERENCE_URL } from "@src/config/agent-setup.config";
import { useServices } from "@src/context/ServicesProvider";
import { useGetStartedChecklist } from "./useGetStartedChecklist";
import { useGetStartedQuickPicks } from "./useGetStartedQuickPicks";

export const DEPENDENCIES = { useGetStartedChecklist, useGetStartedQuickPicks, useOnboardingApiKey, useRouter, useServices };

export const AKASHML_URL = "https://playground.akashml.com/?utm_source=akash-console&utm_medium=get-started&utm_campaign=trial-onboarding";

export const AKASHML_MODELS = ["Llama 3.3 70B", "Qwen", "GPT OSS 120B"];

export const DEPLOY_PROMPT = "Deploy nginx on Akash";

export const AKT_INSTALL_COMMAND = "brew install akash-network/tap/akt";

export const AKT_CONTEXT_COMMAND = "akt context create console --deploy-via console --set-current";

export const AKT_DEPLOY_COMMAND = "akt deploy deploy.yaml";

export const LIST_DEPLOYMENTS_COMMAND = 'curl https://console-api.akash.network/v1/deployments -H "x-api-key: $AKASH_API_KEY"';

const COPIED_FEEDBACK_MS = 1500;

type GetStartedStep = "deploy" | "api_key" | "agent";

type ToolTab = "agent" | "akt" | "rest";

const TOOL_TABS: { id: ToolTab; label: string; Icon: LucideIcon }[] = [
  { id: "agent", label: "Agent", Icon: Sparkles },
  { id: "akt", label: "akt CLI", Icon: Terminal },
  { id: "rest", label: "REST API", Icon: Braces }
];

const BAR_BUTTON_CLASSES = "h-8 gap-1.5 rounded-lg px-3 text-[12.5px] no-underline hover:no-underline";

const exportApiKeyLine = (apiKey: string) => `export AKASH_API_KEY="${apiKey}"`;

const aktLoginLine = (apiKey: string) => `akt console login ${apiKey}`;

export function GetStartedChecklist({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const { isVisible, steps, hasSetUpTools, doneCount, stepCount, isComplete, dismiss, markAgentSetupCopied } = d.useGetStartedChecklist();
  const router = d.useRouter();
  const [quickPick] = d.useGetStartedQuickPicks();
  const { urlService, analyticsService } = d.useServices();
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isCreatedKeyReleased, setIsCreatedKeyReleased] = useState(false);
  const onboardingApiKey = d.useOnboardingApiKey({ enabled: isVisible && isToolsOpen });
  const isHoldingUncopiedKey = !!onboardingApiKey.createdApiKey?.apiKey && !isCreatedKeyReleased;

  if (!isVisible && !isHoldingUncopiedKey) return null;

  const nextStep = !steps.hasDeployed ? "deploy" : !hasSetUpTools ? "tools" : undefined;

  const trackStepClick = (step: GetStartedStep, option: string) => {
    analyticsService.track("get_started_step_click", { category: "onboarding", step, option });
  };

  const deployQuickPick = () => {
    trackStepClick("deploy", quickPick.templateId);
    router.push(urlService.configureDeployment({ templateId: quickPick.templateId, sdlStrategy: "default", bidStrategy: "auto" }));
  };

  const toggleTools = () => {
    if (!isToolsOpen) trackStepClick("agent", "open_tools");
    setIsToolsOpen(isOpen => !isOpen);
  };

  const createApiKey = () => {
    trackStepClick("api_key", "create_key");
    onboardingApiKey.createApiKey();
  };

  const copySetupCommand = async (tab: ToolTab, text: string) => {
    trackStepClick("agent", `copy_${tab}`);
    const isCopied = await copyTextToClipboard(text);
    if (isCopied) markAgentSetupCopied();
    return isCopied;
  };

  const copyKeyCommand = async (tab: ToolTab, text: string) => {
    const isCopied = await copySetupCommand(tab, text);
    if (isCopied) setIsCreatedKeyReleased(true);
    return isCopied;
  };

  const dismissChecklist = () => {
    setIsCreatedKeyReleased(true);
    dismiss();
  };

  const keyStep = (tab: ToolTab, line: (apiKey: string) => string) => (
    <KeyStep
      createdApiKey={onboardingApiKey.createdApiKey}
      isCreating={onboardingApiKey.isCreating || onboardingApiKey.isLoadingTrialProject}
      hasApiKey={steps.hasApiKey}
      line={line}
      onCreate={createApiKey}
      onCopy={text => copyKeyCommand(tab, text)}
    />
  );

  return (
    <section aria-labelledby="get-started-title" className="mb-8">
      <div className="mb-3 flex min-h-7 items-center gap-3">
        <h2 id="get-started-title" className="font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground">
          {isComplete ? "You're set up" : "Get started"}
        </h2>
        <span className="inline-flex items-center gap-2 whitespace-nowrap font-mono text-[11px] font-medium leading-4 text-muted-foreground">
          <ProgressRing doneCount={doneCount} total={stepCount} />
          {doneCount} of {stepCount} done
        </span>
        <Button
          variant="link"
          size="sm"
          className="ml-auto h-7 px-0 text-[13px] text-muted-foreground"
          aria-label="Dismiss Get started"
          onClick={dismissChecklist}
        >
          Dismiss
        </Button>
      </div>

      <ol className="flex flex-col gap-3">
        <StepBar
          Icon={Rocket}
          isDone={steps.hasDeployed}
          title="Deploy your first app"
          description={
            steps.hasDeployed
              ? "Your first app is live. Deploy another any time."
              : "Start with a ready-made page, or bring your own Docker image. Runs on your trial credits."
          }
          actions={
            <>
              <Button variant="outline" size="sm" className={BAR_BUTTON_CLASSES} asChild>
                <Link href={urlService.configureDeployment({ exampleImage: true })} onClick={() => trackStepClick("deploy", "custom-image")}>
                  <Container className="h-3.5 w-3.5" />
                  Your image
                </Link>
              </Button>
              {quickPick && (
                <Button variant={nextStep === "deploy" ? "default" : "outline"} size="sm" className={BAR_BUTTON_CLASSES} onClick={deployQuickPick}>
                  Deploy {quickPick.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          }
        />

        <StepBar
          Icon={KeyRound}
          isDone={hasSetUpTools}
          title="Create an API key and connect your tools"
          description={
            hasSetUpTools
              ? "Your key is set up. Deploy from your agent, the CLI or the API."
              : "Your agent, the akt CLI and the REST API all use a Console API key. Create one here, then pick how you'll deploy."
          }
          actions={
            <Button
              variant={nextStep === "tools" ? "default" : "outline"}
              size="sm"
              className={BAR_BUTTON_CLASSES}
              aria-expanded={isToolsOpen}
              aria-controls="get-started-tools"
              onClick={toggleTools}
            >
              Set up your tools
              {isToolsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          }
        >
          {isToolsOpen && (
            <Tabs id="get-started-tools" defaultValue="agent" className="border-t border-border bg-background">
              <TabsList aria-label="How you'll deploy" className="flex h-auto justify-start gap-1 bg-transparent px-3 pb-0 pt-2.5">
                {TOOL_TABS.map(tab => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="h-[30px] gap-[7px] rounded-[7px] border border-transparent px-3 py-0 text-[13px] text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none hover:text-foreground"
                  >
                    <tab.Icon className="h-[13px] w-[13px]" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="agent" className="mt-0">
                <ToolPanel>
                  <PanelStep number={1} title="Install the Akash skill" description="In your terminal, for Claude Code, Codex, Cursor or OpenCode:">
                    <CopyCommand label="skill install command" text={AKASH_SKILL_INSTALL_COMMAND} onCopy={text => copySetupCommand("agent", text)} />
                  </PanelStep>
                  <PanelStep number={2} title="Give it an API key" description="The agent deploys on your behalf using a Console API key.">
                    {keyStep("agent", exportApiKeyLine)}
                  </PanelStep>
                  <PanelStep number={3} title="Ask it to deploy" description="Try this prompt first:">
                    <CopyCommand label="deploy prompt" text={DEPLOY_PROMPT} isPrompt onCopy={text => copySetupCommand("agent", text)} />
                    <GuideLink href={AI_AGENTS_DOCS_URL}>Setup guide</GuideLink>
                  </PanelStep>
                </ToolPanel>
              </TabsContent>

              <TabsContent value="akt" className="mt-0">
                <ToolPanel>
                  <PanelStep number={1} title="Install akt" description="With Homebrew on macOS or Linux:">
                    <CopyCommand label="akt install command" text={AKT_INSTALL_COMMAND} onCopy={text => copySetupCommand("akt", text)} />
                  </PanelStep>
                  <PanelStep number={2} title="Log in with an API key" description="Create a Console context, then log in with your key.">
                    <CopyCommand label="akt context command" text={AKT_CONTEXT_COMMAND} onCopy={text => copySetupCommand("akt", text)} />
                    {keyStep("akt", aktLoginLine)}
                  </PanelStep>
                  <PanelStep number={3} title="Deploy" description="Console pays from your trial credits, so there's no deposit.">
                    <CopyCommand label="akt deploy command" text={AKT_DEPLOY_COMMAND} onCopy={text => copySetupCommand("akt", text)} />
                    <GuideLink href={AKT_DOCS_URL}>akt docs</GuideLink>
                  </PanelStep>
                </ToolPanel>
              </TabsContent>

              <TabsContent value="rest" className="mt-0">
                <ToolPanel>
                  <PanelStep number={1} title="Set your API key" description="Every request authenticates with the x-api-key header.">
                    {keyStep("rest", exportApiKeyLine)}
                  </PanelStep>
                  <PanelStep number={2} title="List your deployments" description="A quick check that your key works:">
                    <CopyCommand label="list deployments command" text={LIST_DEPLOYMENTS_COMMAND} onCopy={text => copySetupCommand("rest", text)} />
                  </PanelStep>
                  <PanelStep number={3} title="Create a deployment" description="POST your SDL. Your trial credits fund it.">
                    <GuideLink href={API_REFERENCE_URL}>API reference</GuideLink>
                  </PanelStep>
                </ToolPanel>
              </TabsContent>
            </Tabs>
          )}
        </StepBar>
      </ol>

      <AkashMlCard onOpen={() => analyticsService.track("akashml_link_click", { category: "onboarding", placement: "get_started" })} />
    </section>
  );
}

function StepBar({
  Icon,
  isDone,
  title,
  description,
  actions,
  children
}: {
  Icon: LucideIcon;
  isDone: boolean;
  title: string;
  description: string;
  actions: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <span
          className={cn(
            "inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border",
            isDone ? "border-foreground bg-foreground text-background" : "border-border bg-muted text-foreground/80"
          )}
        >
          {isDone ? (
            <>
              <Check className="h-[15px] w-[15px]" aria-hidden />
              <span className="sr-only">Done:</span>
            </>
          ) : (
            <Icon className="h-[15px] w-[15px]" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-[1_1_240px]">
          <h3 className="text-sm font-semibold leading-5 text-foreground">{title}</h3>
          <p className="mt-0.5 max-w-[800px] text-xs leading-normal text-muted-foreground">{description}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      {children}
    </li>
  );
}

function ToolPanel({ children }: { children: ReactNode }) {
  return <ol className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-7 px-4 py-5">{children}</ol>;
}

function PanelStep({ number, title, description, children }: { number: number; title: string; description: string; children?: ReactNode }) {
  return (
    <li className="min-w-0">
      <div className="mb-2 flex items-baseline gap-2.5">
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{number}</span>
        <h4 className="text-[13.5px] font-semibold text-foreground">{title}</h4>
      </div>
      <p className="text-[12.5px] leading-normal text-muted-foreground">{description}</p>
      {children}
    </li>
  );
}

type KeyStepProps = {
  createdApiKey: ReturnType<typeof useOnboardingApiKey>["createdApiKey"];
  isCreating: boolean;
  hasApiKey: boolean;
  line: (apiKey: string) => string;
  onCreate: () => void;
  onCopy: (text: string) => Promise<boolean>;
};

function KeyStep({ createdApiKey, isCreating, hasApiKey, line, onCreate, onCopy }: KeyStepProps) {
  const secret = createdApiKey?.apiKey;

  if (secret) {
    return (
      <>
        <CopyCommand label="API key command" text={line(secret)} shown={line(`${secret.slice(0, 12)}…`)} onCopy={onCopy} />
        <p className="mt-2 text-xs leading-[17px] text-muted-foreground">&ldquo;{createdApiKey.name}&rdquo; is shown once. Copy it now.</p>
      </>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="mt-3 inline-flex items-center gap-1.5 rounded text-[12.5px] font-semibold text-foreground underline-offset-[3px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        disabled={isCreating}
        onClick={onCreate}
      >
        {isCreating ? "Creating key…" : "Create API key"}
        <ArrowRight className="h-3 w-3" />
      </button>
      {hasApiKey && <p className="mt-2 text-xs leading-[17px] text-muted-foreground">Or use a key you already have.</p>}
    </div>
  );
}

function CopyCommand({
  label,
  text,
  shown,
  isPrompt,
  onCopy
}: {
  label: string;
  text: string;
  shown?: string;
  isPrompt?: boolean;
  onCopy: (text: string) => Promise<boolean>;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const resetTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(function clearFeedbackTimerOnUnmount() {
    return function clearFeedbackTimer() {
      clearTimeout(resetTimeout.current);
    };
  }, []);

  const copy = async () => {
    if (!(await onCopy(text))) return;
    setIsCopied(true);
    clearTimeout(resetTimeout.current);
    resetTimeout.current = setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-border bg-muted py-2 pl-2.5 pr-2">
      <code
        title={shown ?? text}
        className={cn("min-w-0 flex-1 truncate text-foreground", isPrompt ? "font-sans text-[12.5px]" : "font-mono text-[11px] leading-4")}
      >
        {shown ?? text}
      </code>
      <button
        type="button"
        aria-label={isCopied ? "Copied" : `Copy ${label}`}
        className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={copy}
      >
        {isCopied ? <Check className="h-[13px] w-[13px]" /> : <Copy className="h-[13px] w-[13px]" />}
      </button>
    </div>
  );
}

function GuideLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-foreground underline-offset-[3px] hover:underline"
    >
      {children}
      <ArrowUpRight className="h-3 w-3" />
    </a>
  );
}

function AkashMlCard({ onOpen }: { onOpen: () => void }) {
  return (
    <aside
      aria-labelledby="get-started-akashml-title"
      className="relative mt-3 overflow-hidden rounded-[14px] border border-border bg-card bg-[radial-gradient(520px_180px_at_0%_0%,rgba(255,65,65,0.12),transparent_70%),radial-gradient(560px_200px_at_100%_100%,rgba(91,109,246,0.14),transparent_70%),radial-gradient(420px_160px_at_55%_120%,rgba(193,89,240,0.10),transparent_70%)] shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#FF4141] via-[#C159F0] to-[#5B6DF6] text-white shadow-sm">
          <Sparkles className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-[1_1_280px]">
          <p className="font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground">AkashML</p>
          <h3 id="get-started-akashml-title" className="mt-0.5 text-[15px] font-semibold leading-5 text-foreground">
            Need a bigger model? Call it as an API.
          </h3>
          <p className="mt-0.5 text-xs leading-normal text-muted-foreground">Open models hosted on Akash. Pay per token, no GPU to rent.</p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Models on AkashML">
            {AKASHML_MODELS.map(model => (
              <li key={model} className="rounded-full border border-border bg-background/80 px-2.5 py-0.5 font-mono text-[11px] text-foreground">
                {model}
              </li>
            ))}
          </ul>
        </div>
        <Button size="sm" className="ml-auto h-9 gap-1.5 rounded-lg px-4 text-[13px] no-underline hover:no-underline" asChild>
          <a href={AKASHML_URL} target="_blank" rel="noopener noreferrer" onClick={onOpen}>
            Try AkashML
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </aside>
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
