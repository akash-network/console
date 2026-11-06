"use client";
import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import { Badge, Sheet, SheetClose, SheetContent, SheetTitle, Spinner } from "@akashnetwork/ui/components";
import { X } from "lucide-react";

import { useAssistantPrivacyQuery, useUpdateAssistantConsentMutation } from "@src/queries/useAssistantQueries";
import { AssistantComposer } from "../AssistantComposer/AssistantComposer";
import { AssistantConsentCard } from "../AssistantConsentCard/AssistantConsentCard";
import { ASSISTANT_CONSENT_COPY_VERSION } from "../assistantConsentCopy";
import { AssistantTranscript } from "../AssistantTranscript/AssistantTranscript";
import { DiscordHelpCard } from "../DiscordHelpCard/DiscordHelpCard";
import type { AssistantConversation } from "../useAssistantConversation/useAssistantConversation";

export const DEPENDENCIES = {
  useAssistantPrivacyQuery,
  useUpdateAssistantConsentMutation,
  AssistantConsentCard,
  AssistantTranscript,
  AssistantComposer,
  DiscordHelpCard
};

type Props = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  conversation: AssistantConversation;
  question?: string;
  /** Changes on every open request, so a new prefilled question replaces whatever was typed before. */
  openedAt: number;
  dependencies?: typeof DEPENDENCIES;
};

export const AssistantPanel: FC<Props> = ({ isOpen, onOpenChange, conversation, question, openedAt, dependencies: d = DEPENDENCIES }) => {
  const privacy = d.useAssistantPrivacyQuery({ enabled: isOpen });
  const { mutateAsync: updateConsent, isPending: isSavingConsent } = d.useUpdateAssistantConsentMutation();
  const [hasConsentFailed, setHasConsentFailed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const consent = privacy.data?.consent;
  const needsConsent = conversation.problem === "consent" || (!!privacy.data && consent?.copyVersion !== ASSISTANT_CONSENT_COPY_VERSION);
  const isReady = !!privacy.data && !needsConsent;

  useEffect(
    function followTheLatestMessage() {
      const scrollArea = scrollRef.current;
      if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
    },
    [conversation.messages, conversation.problem, conversation.endedAs]
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

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" hideCloseButton aria-describedby={undefined} className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-[440px]">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
          <SheetTitle className="text-base">Console assistant</SheetTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-normal text-muted-foreground">
              Beta
            </Badge>
            <SheetClose aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </SheetClose>
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
            <p className="text-sm text-muted-foreground">Ask about your deployments, bids, logs, or billing. The assistant reads your account to answer.</p>
          )}

          {isReady && <d.AssistantTranscript conversation={conversation} />}
        </div>

        {isReady && (
          <footer className="shrink-0 border-t p-3">
            <d.AssistantComposer key={openedAt} initialValue={question} isSending={conversation.isAnswering} onSend={conversation.send} />
          </footer>
        )}
      </SheetContent>
    </Sheet>
  );
};
