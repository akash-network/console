"use client";
import { useState } from "react";
import { Button, Card, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowDown, Sparks } from "iconoir-react";
import Link from "next/link";

import { ExternalLink } from "@src/components/shared/ExternalLink";
import { useServices } from "@src/context/ServicesProvider";
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
    <Card className="mb-6 p-6">
      <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
              <Sparks className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Deploy with Agent mode</h3>
              <p className="text-sm text-muted-foreground">
                Describe your deployment in plain language. The Akash skill drafts the SDL and deploys it from your coding agent.
              </p>
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 space-x-2 self-start">
              <span>Set up Agent mode</span>
              <NavArrowDown className={cn("text-xs transition-transform", isOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="mt-6 grid grid-cols-1 gap-6 border-t pt-6 md:grid-cols-3">
            <AgentModeStep index={1} title="Install the Akash skill">
              <p className="text-sm text-muted-foreground">In Claude Code, Codex, or OpenCode:</p>
              <code className="mt-2 block overflow-x-auto rounded-md bg-secondary px-3 py-2 text-sm">{SKILL_INSTALL_COMMAND}</code>
            </AgentModeStep>

            <AgentModeStep index={2} title="Create an API key">
              <p className="text-sm text-muted-foreground">
                The agent deploys on your behalf using a Console API key.{" "}
                <Link href={UrlService.userApiKeys()} className="whitespace-nowrap text-primary underline">
                  Go to API keys →
                </Link>
              </p>
            </AgentModeStep>

            <AgentModeStep index={3} title="Read the setup guide">
              <p className="text-sm text-muted-foreground">Full walkthrough for connecting your agent and deploying.</p>
              <div className="mt-2 text-sm text-primary">
                <ExternalLink href={AI_AGENTS_DOCS_URL} text="Setup guide" />
              </div>
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
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded bg-secondary text-xs font-medium">{index}</span>
      <h4 className="text-sm font-semibold">{title}</h4>
    </div>
    <div className="mt-2">{children}</div>
  </div>
);
