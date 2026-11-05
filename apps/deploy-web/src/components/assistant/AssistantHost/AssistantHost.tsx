"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { AssistantPanel } from "../AssistantPanel/AssistantPanel";
import { useAssistantConversation } from "../useAssistantConversation/useAssistantConversation";
import { useAssistantPanel } from "../useAssistantPanel/useAssistantPanel";

export const DEPENDENCIES = { useFlag, useUser, usePathname, useAssistantPanel, useAssistantConversation, AssistantPanel };

type Props = { dependencies?: typeof DEPENDENCIES };

const DEPLOYMENT_PATH = /^\/deployments\/(\d+)(?:\/|$)/;

export function dseqOfPath(pathname: string | null): string | undefined {
  return pathname?.match(DEPLOYMENT_PATH)?.[1];
}

/** Hosts the one assistant panel, for signed-in users with the feedback loop enabled. */
export function AssistantHost({ dependencies: d = DEPENDENCIES }: Props) {
  const isEnabled = d.useFlag("user_feedback_loop");
  const { user } = d.useUser();

  return isEnabled && !!user?.userId ? <AssistantPanelHost dependencies={d} /> : null;
}

function AssistantPanelHost({ dependencies: d }: { dependencies: typeof DEPENDENCIES }) {
  const pathname = d.usePathname();
  const panel = d.useAssistantPanel();
  const conversation = d.useAssistantConversation({
    context: { page: pathname ?? undefined, dseq: panel.request.context?.dseq ?? dseqOfPath(pathname) }
  });
  const shownPathname = useRef(pathname);
  const { close } = panel;

  useEffect(
    function closeOnNavigation() {
      if (shownPathname.current === pathname) return;
      shownPathname.current = pathname;
      close();
    },
    [pathname, close]
  );

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
