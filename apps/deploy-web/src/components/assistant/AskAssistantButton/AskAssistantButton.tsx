"use client";
import type { FC } from "react";
import type { ButtonProps } from "@akashnetwork/ui/components";
import { Button } from "@akashnetwork/ui/components";
import { Sparkles } from "lucide-react";

import { useFlag } from "@src/hooks/useFlag";
import { useAssistantPanel } from "../useAssistantPanel/useAssistantPanel";

export const DEPENDENCIES = { useFlag, useAssistantPanel };

type Props = {
  dseq: string;
  question: string;
  label: string;
  variant?: ButtonProps["variant"];
  sendsQuestion?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/** Opens the assistant about one deployment with a question ready to send; renders nothing while the assistant is off. */
export const AskAssistantButton: FC<Props> = ({ dseq, question, label, variant = "outline", sendsQuestion, dependencies: d = DEPENDENCIES }) => {
  const isEnabled = d.useFlag("user_feedback_loop");
  const { open } = d.useAssistantPanel();

  if (!isEnabled) return null;

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className="gap-1.5"
      onClick={() => open({ context: { dseq }, question, ...(sendsQuestion && { sendsQuestion }) })}
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
};
