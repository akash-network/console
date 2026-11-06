"use client";
import type { FC, FormEvent, KeyboardEvent } from "react";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { ArrowUp } from "lucide-react";

/** The api refuses a longer message. */
const MAX_MESSAGE_LENGTH = 4_000;

type Props = {
  initialValue?: string;
  isSending: boolean;
  onSend: (message: string) => void;
};

export const AssistantComposer: FC<Props> = ({ initialValue = "", isSending, onSend }) => {
  const [message, setMessage] = useState(initialValue);
  const canSend = !isSending && message.trim().length > 0;

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
    <form onSubmit={send} className="flex items-end gap-2 rounded-xl border bg-background p-2 focus-within:ring-1 focus-within:ring-ring">
      <textarea
        aria-label="Message the assistant"
        placeholder="Ask anything about your deployments..."
        rows={2}
        maxLength={MAX_MESSAGE_LENGTH}
        value={message}
        onChange={event => setMessage(event.target.value)}
        onKeyDown={sendOnEnter}
        className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
      />
      <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={!canSend} aria-label="Send">
        <ArrowUp className="h-4 w-4" />
      </Button>
    </form>
  );
};
