"use client";
import { usePathname } from "next/navigation";

import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { AssistantPanel } from "../AssistantPanel/AssistantPanel";
import { dseqOfPath } from "../dseqOfPath/dseqOfPath";
import { useAssistantConversation } from "../useAssistantConversation/useAssistantConversation";
import { useAssistantPanel } from "../useAssistantPanel/useAssistantPanel";

export const DEPENDENCIES = { useFlag, useUser, usePathname, useAssistantPanel, useAssistantConversation, AssistantPanel };

type Props = { dependencies?: typeof DEPENDENCIES };

/** Hosts the one assistant panel above the pages, so it stays open with its conversation while the user navigates. */
export function AssistantHost({ dependencies: d = DEPENDENCIES }: Props) {
  const isEnabled = d.useFlag("user_feedback_loop");
  const { user } = d.useUser();

  return isEnabled && !!user?.userId ? <AssistantPanelHost dependencies={d} /> : null;
}

function AssistantPanelHost({ dependencies: d }: { dependencies: typeof DEPENDENCIES }) {
  const pathname = d.usePathname();
  const panel = d.useAssistantPanel();
  const conversation = d.useAssistantConversation({
    context: { page: pathname ?? undefined, dseq: dseqOfPath(pathname) ?? panel.request.context?.dseq }
  });
  const { close } = panel;

  return (
    <d.AssistantPanel
      isOpen={panel.isOpen}
      onOpenChange={isOpen => (isOpen ? undefined : close())}
      conversation={conversation}
      question={panel.request.question}
      openedAt={panel.openedAt}
    />
  );
}
