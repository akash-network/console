import { describe, expect, it } from "vitest";

import type { AssistantAction, AssistantStreamEvent } from "@src/types/assistant";
import type { AssistantTranscriptMessage } from "./transcriptModel";
import {
  applyAssistantEvent,
  applyTurnEvent,
  createTranscriptMessage,
  historyOf,
  MAX_HISTORY_MESSAGES,
  readLabelOfClientTool,
  tailLinesOf
} from "./transcriptModel";

describe("transcriptModel", () => {
  describe(applyAssistantEvent.name, () => {
    it("appends streamed text", () => {
      const message = applyAssistantEvent(answer({ text: "Your " }), { type: "text_delta", text: "lease is active." });

      expect(message.text).toBe("Your lease is active.");
    });

    it("adds a read chip named after the tool when a tool starts", () => {
      const message = applyAssistantEvent(answer(), { type: "tool_started", toolCallId: "t-1", name: "get_lease_close_reason" });

      expect(message.reads).toEqual([{ id: "t-1", label: "lease close reason", ok: true }]);
    });

    it("replaces the chip with the summary of what the tool read", () => {
      const started = applyAssistantEvent(answer(), { type: "tool_started", toolCallId: "t-1", name: "get_bids" });

      const message = applyAssistantEvent(started, {
        type: "tool_result_summary",
        toolCallId: "t-1",
        name: "get_bids",
        ok: false,
        summary: "bids, GPU availability"
      });

      expect(message.reads).toEqual([{ id: "t-1", label: "bids, GPU availability", ok: false }]);
    });

    it("keeps the tool name when the summary is empty, and adds a chip for a summary of a tool it never saw start", () => {
      const message = applyAssistantEvent(answer(), { type: "tool_result_summary", toolCallId: "t-2", name: "search_docs", ok: true, summary: "" });

      expect(message.reads).toEqual([{ id: "t-2", label: "docs", ok: true }]);
    });

    it("leaves the other chips alone when a summary arrives", () => {
      const events: AssistantStreamEvent[] = [
        { type: "tool_started", toolCallId: "t-1", name: "list_deployments" },
        { type: "tool_started", toolCallId: "t-2", name: "get_balance_and_spend" },
        { type: "tool_result_summary", toolCallId: "t-2", name: "get_balance_and_spend", ok: true, summary: "balance" }
      ];

      const message = events.reduce(applyAssistantEvent, answer());

      expect(message.reads.map(read => read.label)).toEqual(["deployments", "balance"]);
    });

    it("adds a chip saying what the browser reads for a client tool", () => {
      const message = applyAssistantEvent(answer(), {
        type: "client_tool_request",
        toolCallId: "t-3",
        name: "read_logs",
        arguments: { dseq: "1", service: "web", tailLines: 100 },
        maxLength: 16000
      });

      expect(message.reads).toEqual([{ id: "t-3", label: "logs (web, last 100 lines)", ok: true }]);
    });

    it("collects proposed actions", () => {
      const action: AssistantAction = { type: "send_manifest_again", tier: "confirm", dseq: "42" };

      const message = applyAssistantEvent(answer(), { type: "action_proposal", proposalId: "p-1", action });

      expect(message.proposals).toEqual([{ proposalId: "p-1", action, diagnosis: undefined }]);
    });

    it("keeps the diagnosis behind a proposed fix", () => {
      const action: AssistantAction = { type: "send_manifest_again", tier: "confirm", dseq: "42" };
      const diagnosis = { summary: "Out of memory", evidence: ["OOMKilled"] };
      const message = applyAssistantEvent(answer(), { type: "action_proposal", proposalId: "p-1", action, diagnosis });

      expect(message.proposals).toEqual([{ proposalId: "p-1", action, diagnosis }]);
    });

    it("remembers why the assistant suggested live help", () => {
      expect(answer().liveHelpReason).toBeNull();
      expect(applyAssistantEvent(answer({ text: "Ask on Discord" }), { type: "live_help_suggested", reason: "provider_side_issue" })).toEqual(
        answer({ text: "Ask on Discord", liveHelpReason: "provider_side_issue" })
      );
    });

    it("ignores events that do not change the answer", () => {
      const message = answer({ text: "Done" });

      expect(applyAssistantEvent(message, { type: "done", reason: "stop" })).toBe(message);
      expect(applyAssistantEvent(message, { type: "error", code: "assistant_error", message: "x" })).toBe(message);
    });
  });

  describe(readLabelOfClientTool.name, () => {
    it("names events and the default tail when no service is asked for", () => {
      expect(readLabelOfClientTool({ name: "read_events", arguments: { dseq: "1" } })).toBe("events (last 200 lines)");
    });
  });

  describe(tailLinesOf.name, () => {
    it("reads 200 lines unless the assistant asks for another count", () => {
      expect(tailLinesOf({ arguments: { dseq: "1" } })).toBe(200);
      expect(tailLinesOf({ arguments: { dseq: "1", tailLines: 50 } })).toBe(50);
    });
  });

  describe(historyOf.name, () => {
    it("resends messages with text, oldest first", () => {
      const history = historyOf([
        createTranscriptMessage("1", "user", "Why no bids?"),
        createTranscriptMessage("2", "assistant", "  "),
        createTranscriptMessage("3", "assistant", "No provider has 8 GPUs free.")
      ]);

      expect(history).toEqual([
        { role: "user", content: "Why no bids?" },
        { role: "assistant", content: "No provider has 8 GPUs free." }
      ]);
    });

    it("keeps only the latest messages the api accepts and caps each one's length", () => {
      const messages = Array.from({ length: MAX_HISTORY_MESSAGES + 2 }, (_, index) => createTranscriptMessage(`${index}`, "user", `message ${index}`));
      messages.push(createTranscriptMessage("long", "assistant", "x".repeat(9000)));

      const history = historyOf(messages);

      expect(history).toHaveLength(MAX_HISTORY_MESSAGES);
      expect(history[0].content).toBe("message 3");
      expect(history.at(-1)?.content).toHaveLength(8000);
    });
  });

  describe(applyTurnEvent.name, () => {
    const ids = { questionId: "q-1", answerId: "a-1" };

    it("marks the question with the count of secrets removed, adding up over a turn", () => {
      const messages = [createTranscriptMessage("q-0", "user", "earlier"), createTranscriptMessage("q-1", "user", "my key"), answer()];

      const once = applyTurnEvent(messages, ids, { type: "secret_redacted", count: 1 });
      const twice = applyTurnEvent(once, ids, { type: "secret_redacted", count: 2 });

      expect(twice.map(message => message.redactedSecretCount)).toEqual([0, 3, 0]);
    });

    it("builds the answer from every other event", () => {
      const messages = [createTranscriptMessage("q-1", "user", "hi"), answer()];

      const next = applyTurnEvent(messages, ids, { type: "text_delta", text: "Hello" });

      expect(next.map(message => message.text)).toEqual(["hi", "Hello"]);
    });
  });

  function answer(input: Partial<AssistantTranscriptMessage> = {}): AssistantTranscriptMessage {
    return { ...createTranscriptMessage("a-1", "assistant"), ...input };
  }
});
