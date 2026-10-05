"use client";
import type { FC, ReactNode } from "react";
import { useState } from "react";
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger, Snackbar } from "@akashnetwork/ui/components";
import { ArrowRight, ChevronDown, Copy, ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSnackbar } from "notistack";

import { AI_AGENTS_DOCS_URL, AKASH_SKILL_INSTALL_COMMAND } from "@src/config/agent-setup.config";
import { useServices } from "@src/context/ServicesProvider";
import { copyTextToClipboard } from "@src/utils/copyClipboard";
import { UrlService } from "@src/utils/urlUtils";

const STEP_LINK_CLASSES = "inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground hover:underline";

export const AgentModePanel: FC = () => {
  const { analyticsService } = useServices();
  const [isOpen, setIsOpen] = useState(false);

  const toggleSetupSteps = (open: boolean) => {
    if (open) analyticsService.track("deploy_with_agent_btn_clk", "Amplitude");
    setIsOpen(open);
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={toggleSetupSteps}
      className="overflow-hidden rounded-[14px] border border-border bg-card text-card-foreground shadow-sm"
    >
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-border bg-muted">
            <Sparkles className="h-[15px] w-[15px] opacity-80" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Deploy with your agent</h2>
            <p className="mt-0.5 max-w-[800px] text-xs leading-normal text-muted-foreground">
              Describe your deployment in plain language. The Akash skill drafts the SDL and deploys it from your coding agent.
            </p>
          </div>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="group shrink-0 gap-1.5 self-start sm:self-center">
            Set up with your agent
            <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden="true" />
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="grid grid-cols-1 gap-7 border-t border-border bg-background px-4 py-5 md:grid-cols-3">
          <SetupStep
            index={1}
            title="Install the Akash skill"
            description="Run it in your terminal. It works with Claude Code, Cursor, Codex, OpenCode and more."
          >
            <InstallCommand command={AKASH_SKILL_INSTALL_COMMAND} />
          </SetupStep>

          <SetupStep index={2} title="Create an API key" description="The agent deploys on your behalf using a Console API key.">
            <Link href={UrlService.userApiKeys()} className={STEP_LINK_CLASSES}>
              Go to API keys
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </SetupStep>

          <SetupStep index={3} title="Read the setup guide" description="Full walkthrough for connecting your agent and deploying.">
            <a href={AI_AGENTS_DOCS_URL} target="_blank" rel="noreferrer" className={STEP_LINK_CLASSES}>
              Setup guide
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </SetupStep>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const SetupStep: FC<{ index: number; title: string; description: string; children: ReactNode }> = ({ index, title, description, children }) => (
  <div className="min-w-0">
    <div className="mb-2 flex items-baseline gap-2.5">
      <span className="shrink-0 font-mono text-xs text-muted-foreground">{index}</span>
      <h3 className="text-[13.5px] font-semibold">{title}</h3>
    </div>
    <p className="text-[12.5px] leading-normal text-muted-foreground">{description}</p>
    <div className="mt-3">{children}</div>
  </div>
);

const InstallCommand: FC<{ command: string }> = ({ command }) => {
  const { enqueueSnackbar } = useSnackbar();

  const copyCommand = () => {
    copyTextToClipboard(command);
    enqueueSnackbar(<Snackbar title="Copied to clipboard!" iconVariant="success" />, { variant: "success", autoHideDuration: 1500 });
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted py-2 pl-2.5 pr-2">
      <code title={command} className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
        {command}
      </code>
      <Button
        aria-label="Copy command"
        onClick={copyCommand}
        size="icon"
        variant="outline"
        type="button"
        className="h-[26px] w-[26px] shrink-0 rounded-md bg-background text-muted-foreground hover:text-foreground"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
};
