"use client";
import type { FC } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Badge, Spinner } from "@akashnetwork/ui/components";
import { X } from "lucide-react";

import { useAssistantPrivacyQuery, useUpdateAssistantConsentMutation } from "@src/queries/useAssistantQueries";
import { AssistantComposer } from "../AssistantComposer/AssistantComposer";
import { AssistantConsentCard } from "../AssistantConsentCard/AssistantConsentCard";
import { ASSISTANT_CONSENT_COPY_VERSION } from "../assistantConsentCopy";
import { AssistantExamplePrompts } from "../AssistantExamplePrompts/AssistantExamplePrompts";
import { AssistantTranscript } from "../AssistantTranscript/AssistantTranscript";
import { DiscordHelpCard } from "../DiscordHelpCard/DiscordHelpCard";
import type { AssistantConversation } from "../useAssistantConversation/useAssistantConversation";

export const DEPENDENCIES = {
  useAssistantPrivacyQuery,
  useUpdateAssistantConsentMutation,
  AssistantConsentCard,
  AssistantExamplePrompts,
  AssistantTranscript,
  AssistantComposer,
  DiscordHelpCard
};

/** Read by the page layout, which pads itself by this much on wide screens so the docked panel never covers the page. */
export const ASSISTANT_PANEL_WIDTH_VAR = "--assistant-panel-width";

/** Moves toasts off the panel's composer while it is open; 20px is notistack's own right indent. */
export const TOASTS_BESIDE_ASSISTANT_PANEL = "lg:!right-[calc(var(--assistant-panel-width,0px)+20px)]";

const DOCKED_PANEL_WIDTH = "440px";

type Props = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  conversation: AssistantConversation;
  question?: string;
  sendsQuestion?: boolean;
  /** Changes on every open request, so a new prefilled question replaces whatever was typed before. */
  openedAt: number;
  dependencies?: typeof DEPENDENCIES;
};

export const AssistantPanel: FC<Props> = ({ isOpen, onOpenChange, conversation, question, sendsQuestion, openedAt, dependencies: d = DEPENDENCIES }) => {
  const privacy = d.useAssistantPrivacyQuery({ enabled: isOpen });
  const { mutateAsync: updateConsent, isPending: isSavingConsent } = d.useUpdateAssistantConsentMutation();
  const [hasConsentFailed, setHasConsentFailed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const consent = privacy.data?.consent;
  const needsConsent = conversation.problem === "consent" || (!!privacy.data && consent?.copyVersion !== ASSISTANT_CONSENT_COPY_VERSION);
  const isReady = !!privacy.data && !needsConsent;
  const sentForOpenRef = useRef<number | null>(null);
  const willSendQuestion = !!sendsQuestion && !!question;
  const isQuestionWaitingToSend = willSendQuestion && sentForOpenRef.current !== openedAt;
  const isAnsweringThisQuestion = conversation.isAnswering && conversation.messages.findLast(message => message.role === "user")?.text === question;

  useEffect(
    function followTheLatestMessage() {
      const scrollArea = scrollRef.current;
      if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
    },
    [conversation.messages, conversation.problem, conversation.endedAs]
  );

  useEffect(
    function askTheQuestionTheUserClicked() {
      if (!isOpen || !isReady || !sendsQuestion || !question || sentForOpenRef.current === openedAt) return;
      if (isAnsweringThisQuestion) {
        sentForOpenRef.current = openedAt;
        return;
      }
      if (conversation.isAnswering) return;
      sentForOpenRef.current = openedAt;
      conversation.send(question);
    },
    [isOpen, isReady, sendsQuestion, question, openedAt, isAnsweringThisQuestion, conversation.isAnswering, conversation.send]
  );

  useEffect(
    function reserveRoomBesideThePage() {
      if (!isOpen) return;
      const root = document.documentElement;
      root.style.setProperty(ASSISTANT_PANEL_WIDTH_VAR, DOCKED_PANEL_WIDTH);
      return function releaseRoomBesideThePage() {
        root.style.removeProperty(ASSISTANT_PANEL_WIDTH_VAR);
      };
    },
    [isOpen]
  );

  useEffect(
    function returnFocusOnceClosed() {
      if (!isOpen) return;
      const focusedBeforeOpening = document.activeElement;
      return function returnFocusUnlessTheUserMovedOn() {
        if (document.activeElement !== document.body || !(focusedBeforeOpening instanceof HTMLElement)) return;
        focusedBeforeOpening.focus();
      };
    },
    [isOpen]
  );

  useEffect(
    function moveFocusIntoThePanel() {
      panelRef.current?.focus();
    },
    [isOpen, openedAt]
  );

  useEffect(
    function closeOnEscapeAnywhere() {
      if (!isOpen) return;
      function closeOnEscape(event: KeyboardEvent) {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        onOpenChange(false);
      }
      window.addEventListener("keydown", closeOnEscape);
      return function stopClosingOnEscape() {
        window.removeEventListener("keydown", closeOnEscape);
      };
    },
    [isOpen, onOpenChange]
  );

  const agree = async ({ reviewOptIn }: { reviewOptIn: boolean }) => {
    setHasConsentFailed(false);
    try {
      await updateConsent({ data: { copyVersion: ASSISTANT_CONSENT_COPY_VERSION, reviewOptIn } });
      conversation.clearProblem();
    } catch {
      setHasConsentFailed(true);
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      className="fixed bottom-0 right-0 top-[var(--app-header-height,57px)] z-40 flex w-full flex-col border-l border-border bg-background shadow-lg outline-none duration-300 animate-in slide-in-from-right-8 motion-reduce:animate-none sm:w-[440px] lg:shadow-none"
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
        <h2 id={titleId} className="text-base font-semibold">
          Console assistant
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Beta
          </Badge>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        {privacy.isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="medium" />
          </div>
        )}

        {privacy.isError && (
          <div className="flex flex-col gap-3">
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t load the assistant. Close the panel and try again.
            </p>
            <d.DiscordHelpCard />
          </div>
        )}

        {needsConsent && (
          <d.AssistantConsentCard isSaving={isSavingConsent} hasFailed={hasConsentFailed} onAgree={agree} onDecline={() => onOpenChange(false)} />
        )}

        {isReady && conversation.messages.length === 0 && !conversation.problem && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Ask about your deployments, bids, logs, or billing. The assistant reads your account to answer.</p>
            {!isQuestionWaitingToSend && (
              <d.AssistantExamplePrompts page={conversation.page} deploymentDseq={conversation.deploymentDseq} onSend={conversation.send} />
            )}
          </div>
        )}

        {isReady && <d.AssistantTranscript conversation={conversation} />}
      </div>

      {isReady && (
        <footer className="shrink-0 border-t p-3">
          <d.AssistantComposer
            key={openedAt}
            initialValue={willSendQuestion ? undefined : question}
            isSending={conversation.isAnswering}
            onSend={conversation.send}
          />
        </footer>
      )}
    </aside>
  );
};
