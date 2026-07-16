"use client";
import { useState } from "react";
import { Button, Card, Collapsible, CollapsibleContent, CollapsibleTrigger, Snackbar } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Copy, NavArrowDown, Sparks } from "iconoir-react";
import Link from "next/link";
import { useSnackbar } from "notistack";

import { ExternalLink } from "@src/components/shared/ExternalLink";
import { useServices } from "@src/context/ServicesProvider";
import { copyTextToClipboard } from "@src/utils/copyClipboard";
import { UrlService } from "@src/utils/urlUtils";

const SKILL_INSTALL_COMMAND = "/plugin marketplace add akash-network/akash-skill";
const AI_AGENTS_DOCS_URL = "https://akash.network/docs/getting-started/ai-agents/";

export const AgentModePanel: React.FunctionComponent = () => {
  const { analyticsService } = useServices();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (open) analyticsService.track("deploy_with_agent_btn_clk", "Amplitude");
    setIsOpen(open);
  };

  return (
    <Card className="mb-6 p-5 sm:p-6">
      <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
              <Sparks className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-base font-bold tracking-tight">Deploy with Agent mode</h3>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Describe your deployment in plain language. The Akash skill drafts the SDL and deploys it from your coding agent.
              </p>
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-2 self-start sm:self-center">
              <span>Set up Agent mode</span>
              <NavArrowDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-6 border-t pt-5 md:grid-cols-3">
            <AgentModeStep index={1} title="Install the Akash skill">
              <p>In Claude Code, Codex, or OpenCode:</p>
              <CommandLine command={SKILL_INSTALL_COMMAND} />
            </AgentModeStep>

            <AgentModeStep index={2} title="Create an API key">
              <p>The agent deploys on your behalf using a Console API key.</p>
              <Link href={UrlService.userApiKeys()} className="inline-flex font-medium text-primary hover:underline">
                Go to API keys →
              </Link>
            </AgentModeStep>

            <AgentModeStep index={3} title="Read the setup guide">
              <p>Full walkthrough for connecting your agent and deploying.</p>
              <span className="font-medium text-primary hover:underline">
                <ExternalLink href={AI_AGENTS_DOCS_URL} text="Setup guide" />
              </span>
            </AgentModeStep>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

type AgentModeStepProps = {
  index: number;
  title: string;
  children: React.ReactNode;
};

const AgentModeStep: React.FunctionComponent<AgentModeStepProps> = ({ index, title, children }) => (
  <div>
    <div className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-muted-foreground">{index}</span>
      <h4 className="text-sm font-semibold">{title}</h4>
    </div>
    <div className="mt-3 space-y-3 text-sm text-muted-foreground">{children}</div>
  </div>
);

const CommandLine: React.FunctionComponent<{ command: string }> = ({ command }) => {
  const { enqueueSnackbar } = useSnackbar();

  const onCopy = () => {
    copyTextToClipboard(command);
    enqueueSnackbar(<Snackbar title="Copied to clipboard!" iconVariant="success" />, { variant: "success", autoHideDuration: 1500 });
  };

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 py-1 pl-3 pr-1">
      <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-foreground">{command}</code>
      <Button aria-label="copy" onClick={onCopy} size="icon" variant="ghost" type="button" className="h-7 w-7 shrink-0 text-muted-foreground">
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};
