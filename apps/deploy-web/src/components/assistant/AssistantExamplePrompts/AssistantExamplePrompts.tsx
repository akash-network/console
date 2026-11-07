"use client";
import type { FC } from "react";
import { useId } from "react";
import { Button } from "@akashnetwork/ui/components";

import { useWallet } from "@src/context/WalletProvider";

export const DEPENDENCIES = { useWallet };

const CONFIGURE_PAGE = /^\/new-deployment\/configure(?:\/|$)/;

/** Each prompt must stay one the assistant's tools can answer or act on, so a click never ends in "I can't do that". */
export const EXAMPLE_PROMPTS = {
  configure: ["Why can't I find providers?", "Can I make this cheaper?", "Which GPU should I pick?"],
  deployment: ["Why isn't my deployment responding?", "Show me the latest logs", "How much is this costing me?", "Add more runtime"],
  trialDeployment: ["Why isn't my deployment responding?", "Show me the latest logs", "How much is this costing me?", "When will this stop running?"],
  general: ["Deploy a web app", "Run an LLM on a GPU", "What will my balance cover?", "Why did my deployment close?"],
  trialGeneral: ["Deploy a web app", "Run an LLM on a GPU", "What can I run on the free trial?", "Why did my deployment close?"]
};

export function examplePromptsFor({ page, deploymentDseq, isTrialing }: { page: string | null; deploymentDseq: string | null; isTrialing: boolean }) {
  if (page && CONFIGURE_PAGE.test(page)) return EXAMPLE_PROMPTS.configure;
  if (deploymentDseq) return isTrialing ? EXAMPLE_PROMPTS.trialDeployment : EXAMPLE_PROMPTS.deployment;
  return isTrialing ? EXAMPLE_PROMPTS.trialGeneral : EXAMPLE_PROMPTS.general;
}

type Props = {
  page: string | null;
  deploymentDseq: string | null;
  onSend: (prompt: string) => void;
  dependencies?: typeof DEPENDENCIES;
};

export const AssistantExamplePrompts: FC<Props> = ({ page, deploymentDseq, onSend, dependencies: d = DEPENDENCIES }) => {
  const { isTrialing } = d.useWallet();
  const headingId = useId();
  const prompts = examplePromptsFor({ page, deploymentDseq, isTrialing });

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-xs font-medium text-muted-foreground">
        Try asking
      </h3>
      <ul className="flex flex-wrap gap-2">
        {prompts.map(prompt => (
          <li key={prompt}>
            <Button type="button" variant="outline" size="sm" className="h-auto whitespace-normal rounded-full py-1.5 text-left" onClick={() => onSend(prompt)}>
              {prompt}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
};
