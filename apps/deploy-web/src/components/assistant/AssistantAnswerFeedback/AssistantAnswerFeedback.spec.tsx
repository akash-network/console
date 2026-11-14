import type { FC } from "react";
import { describe, expect, it, vi } from "vitest";

import type { AssistantTurnRating } from "@src/types/assistant";
import type { AssistantRatableMessage } from "../transcriptModel/transcriptModel";
import { createTranscriptMessage } from "../transcriptModel/transcriptModel";
import type { DEPENDENCIES } from "./AssistantAnswerFeedback";
import { AssistantAnswerFeedback } from "./AssistantAnswerFeedback";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(AssistantAnswerFeedback.name, () => {
  it("offers a thumbs up, a thumbs down and a report, none of them pressed", () => {
    setup({});

    expect(screen.getByRole("button", { name: "Good answer" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Bad answer" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Report a problem" })).toBeInTheDocument();
  });

  it.each([
    { rating: null, clicked: "Good answer", sent: "up" },
    { rating: null, clicked: "Bad answer", sent: "down" },
    { rating: "down", clicked: "Good answer", sent: "up" },
    { rating: "up", clicked: "Good answer", sent: null },
    { rating: "down", clicked: "Bad answer", sent: null }
  ] as const)("rates $sent when $clicked is clicked on an answer rated $rating", async ({ rating, clicked, sent }) => {
    const { onRate } = setup({ rating });

    await userEvent.click(screen.getByRole("button", { name: clicked }));

    expect(onRate).toHaveBeenCalledWith(sent);
  });

  it("shows which rating the answer has", () => {
    setup({ rating: "up" });

    expect(screen.getByRole("button", { name: "Good answer" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Bad answer" })).toHaveAttribute("aria-pressed", "false");
  });

  it("offers to report the problem right after a thumbs down, without opening the report", () => {
    setup({ rating: "down" });

    expect(screen.getByText("Sorry this answer missed. Want to tell the team what went wrong?")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Report a problem" })).toHaveLength(1);
    expect(screen.queryByTestId("report-dialog")).not.toBeInTheDocument();
  });

  it.each([null, "down"] as const)("opens the report for an answer rated %s and sends it through onReport", async rating => {
    const { onReport } = setup({ rating });

    await userEvent.click(screen.getByRole("button", { name: "Report a problem" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onReport).toHaveBeenCalledWith("the note");
  });

  it("closes the report when it asks to", async () => {
    setup({});

    await userEvent.click(screen.getByRole("button", { name: "Report a problem" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByTestId("report-dialog")).not.toBeInTheDocument();
  });

  it("thanks the user instead of offering another report once the answer is reported", () => {
    setup({ rating: "down", reported: true });

    expect(screen.getByRole("status")).toHaveTextContent("Reported. Thanks for telling us.");
    expect(screen.queryByRole("button", { name: "Report a problem" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Sorry this answer missed/)).not.toBeInTheDocument();
  });

  function setup(input: { rating?: AssistantTurnRating; reported?: boolean }) {
    const onRate = vi.fn();
    const onReport = vi.fn(async () => undefined);
    const message: AssistantRatableMessage = {
      ...createTranscriptMessage("a-1", "assistant", "Your lease is active."),
      conversationId: "c-1",
      turnId: "turn-1",
      rating: input.rating ?? null,
      reported: input.reported ?? false
    };
    const ReportProblemDialog: FC<{ onSend: (note: string) => Promise<void>; onClose: () => void }> = ({ onSend, onClose }) => (
      <div data-testid="report-dialog">
        <button type="button" onClick={() => onSend("the note")}>
          Send
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    );
    const dependencies: typeof DEPENDENCIES = { ReportProblemDialog };

    render(<AssistantAnswerFeedback message={message} onRate={onRate} onReport={onReport} dependencies={dependencies} />);

    return { onRate, onReport };
  }
});
