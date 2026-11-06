"use client";
import type { FC } from "react";
import { Button } from "@akashnetwork/ui/components";
import { LoaderCircle, ShieldAlert } from "lucide-react";

import { ActionCard } from "../action-cards/ActionCard/ActionCard";
import { AssistantMarkdown } from "../AssistantMarkdown/AssistantMarkdown";
import { DiagnosisBlock } from "../DiagnosisBlock/DiagnosisBlock";
import { DiscordHelpCard } from "../DiscordHelpCard/DiscordHelpCard";
import type { AssistantProposal, AssistantTranscriptMessage, AssistantVisibleReadChip } from "../transcriptModel/transcriptModel";
import { visibleReadsOf } from "../transcriptModel/transcriptModel";
import type { AssistantConversation, AssistantProblem } from "../useAssistantConversation/useAssistantConversation";

export const DEPENDENCIES = { ActionCard, AssistantMarkdown, DiagnosisBlock, DiscordHelpCard };

export const FOLLOW_UP_ANSWERS = [
  { label: "Deploy something new", message: "I was trying to deploy something new." },
  { label: "Fix a running deployment", message: "I was trying to fix a deployment that's already running." }
];

export const PASTE_REDACTED_NOTICE = "Looks like you pasted a secret. We removed it before sending. Use a secure field instead.";

/** Asks for the set_secret card through the assistant, which knows the deployment's services and variable names the browser doesn't. */
export const SECURE_FIELD_REQUEST = "Help me add that secret to this deployment with the secure field.";

const PROBLEM_MESSAGES: Record<Exclude<AssistantProblem, "consent">, string> = {
  unavailable: "The assistant is unavailable right now.",
  rate_limited: "You're sending messages too quickly. Wait a minute, then try again.",
  daily_limit: "You've reached today's message limit. It resets tomorrow.",
  error: "Something went wrong with that answer. Try sending it again."
};

type Props = {
  conversation: AssistantConversation;
  dependencies?: typeof DEPENDENCIES;
};

export const AssistantTranscript: FC<Props> = ({ conversation, dependencies: d = DEPENDENCIES }) => {
  const { messages, isAnswering, problem, endedAs } = conversation;
  const lastMessage = messages.at(-1);
  const lastQuestion = messages.findLast(message => message.role === "user");
  const lastAnswer = lastMessage?.role === "assistant" ? lastMessage : undefined;
  const lastAnswerText = lastAnswer?.text ?? "";
  const isWaitingForText = isAnswering && !lastAnswerText;
  const isFollowUpAnswer = FOLLOW_UP_ANSWERS.some(answer => answer.message === lastQuestion?.text);
  const showsFollowUp = !isAnswering && !endedAs && !isFollowUpAnswer && !!lastAnswer?.liveHelpReason;
  const canAskIfHelped = !isAnswering && !endedAs && !problem && !!lastAnswerText;

  return (
    <div role="log" aria-label="Conversation" className="flex flex-col gap-5">
      {messages.map(message =>
        message.role === "user" ? (
          <AssistantQuestion
            key={message.id}
            message={message}
            canAddSecretSecurely={!!conversation.deploymentDseq && !isAnswering && message.id === lastQuestion?.id}
            onAddSecretSecurely={() => conversation.send(SECURE_FIELD_REQUEST)}
          />
        ) : (
          <AssistantAnswer
            key={message.id}
            message={message}
            conversationId={conversation.conversationId}
            continueConversation={conversation.send}
            dependencies={d}
          />
        )
      )}

      {isWaitingForText && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Looking into it…
        </p>
      )}

      {showsFollowUp && (
        <div className="flex flex-col gap-3">
          <d.DiscordHelpCard reason={lastAnswer?.liveHelpReason} />
          <p className="text-sm">Before you go, what were you trying to do? It helps us fix this for everyone.</p>
          <div className="flex flex-wrap gap-2">
            {FOLLOW_UP_ANSWERS.map(answer => (
              <Button key={answer.label} type="button" variant="outline" size="sm" className="rounded-full" onClick={() => conversation.send(answer.message)}>
                {answer.label}
              </Button>
            ))}
          </div>
          {conversation.isStored && <p className="text-xs text-muted-foreground">Saved for the team with this conversation. No reply needed.</p>}
        </div>
      )}

      {problem && problem !== "consent" && (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-sm text-destructive">
            {PROBLEM_MESSAGES[problem]}
          </p>
          {problem !== "error" && <d.DiscordHelpCard />}
        </div>
      )}

      {canAskIfHelped && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Did this help?
          <Button type="button" variant="outline" size="xs" onClick={() => conversation.end(true)}>
            Yes
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={() => conversation.end(false)}>
            No
          </Button>
        </div>
      )}

      {endedAs && (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-sm text-muted-foreground">
            {endedAs === "resolved" ? "Glad it helped." : "Sorry it didn't help. Live help is on Discord."}
          </p>
          {endedAs === "unresolved" && <d.DiscordHelpCard />}
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={conversation.startOver}>
            Start a new conversation
          </Button>
        </div>
      )}
    </div>
  );
};

const AssistantQuestion: FC<{ message: AssistantTranscriptMessage; canAddSecretSecurely: boolean; onAddSecretSecurely: () => void }> = ({
  message,
  canAddSecretSecurely,
  onAddSecretSecurely
}) => (
  <div className="ml-8 flex flex-col items-end gap-2 self-end">
    <p className="whitespace-pre-wrap rounded-xl border bg-muted px-4 py-2.5 text-sm">{message.text}</p>
    {message.redactedSecretCount > 0 && (
      <div className="flex flex-col items-end gap-2">
        <p role="note" className="text-right text-xs text-muted-foreground">
          <ShieldAlert className="mr-1 inline h-3.5 w-3.5 align-[-3px]" aria-hidden="true" />
          {PASTE_REDACTED_NOTICE}
        </p>
        {canAddSecretSecurely && (
          <Button type="button" variant="outline" size="xs" onClick={onAddSecretSecurely}>
            Add it securely
          </Button>
        )}
      </div>
    )}
  </div>
);

type AnswerProps = {
  message: AssistantTranscriptMessage;
  conversationId: string | null;
  continueConversation: (message: string) => void;
  dependencies: typeof DEPENDENCIES;
};

const AssistantAnswer: FC<AnswerProps> = ({ message, conversationId, continueConversation, dependencies: d }) => {
  const reads = visibleReadsOf(message.reads);

  return (
    <div className="flex flex-col gap-3">
      {reads.length > 0 && (
        <ul aria-label="What the assistant read" className="flex flex-wrap gap-1.5">
          {reads.map(read => (
            <ReadChip key={read.id} read={read} />
          ))}
        </ul>
      )}
      {message.text && <d.AssistantMarkdown>{message.text}</d.AssistantMarkdown>}
      {message.proposals.map(proposal => (
        <ProposalCard
          key={proposal.proposalId}
          proposal={proposal}
          conversationId={conversationId}
          continueConversation={continueConversation}
          dependencies={d}
        />
      ))}
    </div>
  );
};

const ProposalCard: FC<Omit<AnswerProps, "message"> & { proposal: AssistantProposal }> = ({
  proposal,
  conversationId,
  continueConversation,
  dependencies: d
}) => {
  const card = (
    <d.ActionCard conversationId={conversationId} proposalId={proposal.proposalId} action={proposal.action} continueConversation={continueConversation} />
  );

  return proposal.diagnosis?.evidence.length ? <d.DiagnosisBlock diagnosis={proposal.diagnosis}>{card}</d.DiagnosisBlock> : card;
};

const ReadChip: FC<{ read: AssistantVisibleReadChip }> = ({ read }) => (
  <li data-ok={read.ok} className="group flex items-center gap-1.5 rounded-md border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-green-500 group-data-[ok=false]:bg-muted-foreground" />
    {read.ok ? `Read: ${read.label}` : read.label}
    {read.retried && <span className="opacity-70">retried</span>}
    {!read.ok && <span className="text-destructive">failed</span>}
  </li>
);
