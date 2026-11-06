import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantAction, AssistantLiveHelpReason } from "@src/types/assistant";
import type { AssistantTranscriptMessage } from "../transcriptModel/transcriptModel";
import { createTranscriptMessage } from "../transcriptModel/transcriptModel";
import type { AssistantConversation } from "../useAssistantConversation/useAssistantConversation";
import { AssistantTranscript, DEPENDENCIES, FOLLOW_UP_ANSWERS } from "./AssistantTranscript";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const SUPPORT_URL = "https://discord.gg/akash";

describe("AssistantTranscript", () => {
  it("shows the question, what the assistant read and its answer", () => {
    setup({
      messages: [
        createTranscriptMessage("1", "user", "Why no bids?"),
        message("2", { text: "No provider has 8 GPUs free.", reads: [{ id: "t-1", label: "deployment, bids", ok: true }] })
      ]
    });

    expect(screen.getByText("Why no bids?")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "What the assistant read" })).getByRole("listitem")).toHaveTextContent("Read: deployment, bids");
    expect(screen.getByText("No provider has 8 GPUs free.")).toBeInTheDocument();
  });

  it("marks a read that failed", () => {
    setup({ messages: [message("2", { text: "x", reads: [{ id: "t-1", label: "logs (last 200 lines)", ok: false }] })] });

    expect(screen.getByRole("listitem")).toHaveTextContent("Read: logs (last 200 lines)failed");
  });

  it("renders a card for each proposed action with the conversation it belongs to", () => {
    const action: AssistantAction = { type: "buy_credits", tier: "deep_link", amountUsd: 20 };
    const { ActionCard, DiagnosisBlock, conversation } = setup({
      messages: [message("2", { text: "Buy credits.", proposals: [{ proposalId: "p-1", action }] })]
    });

    expect(ActionCard).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "c-1", proposalId: "p-1", action, continueConversation: conversation.send }),
      expect.anything()
    );
    expect(DiagnosisBlock).not.toHaveBeenCalled();
  });

  it("shows the diagnosis behind a proposed fix around its card", () => {
    const action: AssistantAction = { type: "send_manifest_again", tier: "confirm", dseq: "42" };
    const diagnosis = { summary: "The provider lost the manifest.", evidence: ["manifest not found"] };
    const { ActionCard, DiagnosisBlock } = setup({
      messages: [message("2", { text: "Here is the fix.", proposals: [{ proposalId: "p-1", action, diagnosis }] })]
    });

    expect(DiagnosisBlock).toHaveBeenCalledWith(expect.objectContaining({ diagnosis }), expect.anything());
    expect(within(screen.getByTestId("diagnosis")).getByText("card p-1")).toBeInTheDocument();
    expect(ActionCard).toHaveBeenCalledWith(expect.objectContaining({ proposalId: "p-1", action }), expect.anything());
  });

  it("says it is looking into the question until text arrives", () => {
    setup({ isAnswering: true, messages: [createTranscriptMessage("1", "user", "Hi"), message("2", {})] });

    expect(screen.getByRole("status")).toHaveTextContent("Looking into it…");
    expect(screen.queryByText("Did this help?")).not.toBeInTheDocument();
  });

  it("offers Discord and asks what the user was trying to do when the assistant signals it cannot help", async () => {
    const { conversation, DiscordHelpCard } = setup({
      messages: [message("2", { text: "I can't see inside the provider.", liveHelpReason: "provider_side_issue" })]
    });

    expect(DiscordHelpCard).toHaveBeenCalledWith({ reason: "provider_side_issue" }, expect.anything());
    expect(screen.getByText("Before you go, what were you trying to do? It helps us fix this for everyone.")).toBeInTheDocument();
    expect(screen.queryByText(/Saved for the team/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: FOLLOW_UP_ANSWERS[0].label }));

    expect(conversation.send).toHaveBeenCalledWith(FOLLOW_UP_ANSWERS[0].message);
  });

  it("does not guess from the answer's words that the assistant cannot help", () => {
    const { DiscordHelpCard } = setup({ messages: [message("2", { text: `The Discord at ${SUPPORT_URL} has release notes.` })] });

    expect(DiscordHelpCard).not.toHaveBeenCalled();
    expect(screen.queryByText(/Before you go/)).not.toBeInTheDocument();
  });

  it("waits for the answer to finish before offering live help", () => {
    const { DiscordHelpCard } = setup({ isAnswering: true, messages: [message("2", { text: "Checking", liveHelpReason: "not_supported_here" })] });

    expect(DiscordHelpCard).not.toHaveBeenCalled();
  });

  it("says the conversation is saved for the team when the user allowed review", () => {
    setup({ isStored: true, messages: [message("2", { text: "Try Discord.", liveHelpReason: "no_confident_answer" })] });

    expect(screen.getByText("Saved for the team with this conversation. No reply needed.")).toBeInTheDocument();
  });

  it("does not ask again once the user answered what they were trying to do", () => {
    setup({
      messages: [
        createTranscriptMessage("1", "user", FOLLOW_UP_ANSWERS[1].message),
        message("2", { text: "Thanks. Discord can help.", liveHelpReason: "no_confident_answer" })
      ]
    });

    expect(screen.queryByRole("button", { name: FOLLOW_UP_ANSWERS[0].label })).not.toBeInTheDocument();
  });

  it.each([
    ["unavailable", "The assistant is unavailable right now."],
    ["rate_limited", "You're sending messages too quickly. Wait a minute, then try again."],
    ["daily_limit", "You've reached today's message limit. It resets tomorrow."]
  ] as const)("points to Discord when the assistant is %s", (problem, text) => {
    const { DiscordHelpCard } = setup({ problem });

    expect(screen.getByRole("alert")).toHaveTextContent(text);
    expect(DiscordHelpCard).toHaveBeenCalled();
  });

  it("asks to send again after a failed answer, without Discord", () => {
    const { DiscordHelpCard } = setup({ problem: "error" });

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong with that answer. Try sending it again.");
    expect(DiscordHelpCard).not.toHaveBeenCalled();
  });

  it("shows nothing for a consent problem, which the panel handles", () => {
    setup({ problem: "consent" });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("asks whether the answer helped and ends the conversation with the reply", async () => {
    const { conversation } = setup({ messages: [message("2", { text: "Your lease is active." })] });

    await userEvent.click(screen.getByRole("button", { name: "Yes" }));
    await userEvent.click(screen.getByRole("button", { name: "No" }));

    expect(conversation.end.mock.calls).toEqual([[true], [false]]);
  });

  it("thanks the user once it helped and offers to start over", async () => {
    const { conversation, DiscordHelpCard } = setup({ endedAs: "resolved", messages: [message("2", { text: "Done." })] });

    expect(screen.getByRole("status")).toHaveTextContent("Glad it helped.");
    expect(screen.queryByText("Did this help?")).not.toBeInTheDocument();
    expect(DiscordHelpCard).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Start a new conversation" }));
    expect(conversation.startOver).toHaveBeenCalled();
  });

  it("points to Discord when it did not help", () => {
    const { DiscordHelpCard } = setup({ endedAs: "unresolved" });

    expect(screen.getByRole("status")).toHaveTextContent("Sorry it didn't help. Live help is on Discord.");
    expect(DiscordHelpCard).toHaveBeenCalled();
  });

  function message(id: string, input: Partial<AssistantTranscriptMessage>): AssistantTranscriptMessage {
    return { ...createTranscriptMessage(id, "assistant"), ...input };
  }

  function setup(input: Partial<Pick<AssistantConversation, "messages" | "isAnswering" | "problem" | "endedAs" | "isStored">>) {
    const conversation = Object.assign(mock<AssistantConversation>(), {
      messages: [],
      isAnswering: false,
      problem: null,
      endedAs: null,
      isStored: false,
      conversationId: "c-1",
      send: vi.fn(),
      end: vi.fn(),
      startOver: vi.fn(),
      ...input
    });
    const ActionCard = vi.fn(({ proposalId }: { proposalId: string }) => <p>card {proposalId}</p>);
    const DiagnosisBlock = vi.fn(({ children }: { children: ReactNode }) => <div data-testid="diagnosis">{children}</div>);
    const DiscordHelpCard = vi.fn((_props: { reason?: AssistantLiveHelpReason | null }) => <p>discord card</p>);

    render(
      <AssistantTranscript
        conversation={conversation}
        dependencies={{
          ...DEPENDENCIES,
          ActionCard: ActionCard as unknown as typeof DEPENDENCIES.ActionCard,
          DiagnosisBlock: DiagnosisBlock as unknown as typeof DEPENDENCIES.DiagnosisBlock,
          DiscordHelpCard
        }}
      />
    );

    return { conversation, ActionCard, DiagnosisBlock, DiscordHelpCard };
  }
});
