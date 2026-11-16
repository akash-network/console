"use client";
import type { FC, FormEvent, KeyboardEvent } from "react";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { ArrowUp, LayoutDashboard } from "lucide-react";

/** The api refuses a longer message. */
const MAX_MESSAGE_LENGTH = 4_000;

type Props = {
  initialValue?: string;
  isSending: boolean;
  isDisabled?: boolean;
  contextLabel?: string | null;
  onSend: (message: string) => void;
};

export const AssistantComposer: FC<Props> = ({ initialValue = "", isSending, isDisabled = false, contextLabel, onSend }) => {
  const [message, setMessage] = useState(initialValue);
  const canSend = !isSending && !isDisabled && message.trim().length > 0;

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend) return;
    onSend(message);
    setMessage("");
  };

  const sendOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  return (
    <form onSubmit={send} className="flex flex-col gap-1 rounded-xl border bg-background p-2 focus-within:ring-1 focus-within:ring-ring">
      {contextLabel && (
        <span
          data-testid="assistant-context"
          className="ml-1 mt-0.5 flex max-w-full items-center gap-1.5 self-start rounded-md bg-muted px-2 py-1 text-xs font-medium"
        >
          <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{contextLabel}</span>
        </span>
      )}
      <div className="flex items-end gap-2">
        <textarea
          aria-label="Message the assistant"
          placeholder="Ask anything about your deployments..."
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={isDisabled}
          value={message}
          onChange={event => setMessage(event.target.value)}
          onKeyDown={sendOnEnter}
          className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={!canSend} aria-label="Send">
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
};
