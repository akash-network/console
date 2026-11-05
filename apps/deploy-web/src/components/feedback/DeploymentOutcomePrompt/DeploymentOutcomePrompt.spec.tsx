import type { ComponentProps } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { KnownDeploymentOutcome, RecordedDeploymentOutcome } from "@src/store/deploymentOutcomeStore";
import type { DeploymentOutcomeCard } from "../DeploymentOutcomeCard/DeploymentOutcomeCard";
import { DEPENDENCIES, DeploymentOutcomePrompt } from "./DeploymentOutcomePrompt";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

type CardProps = ComponentProps<typeof DeploymentOutcomeCard>;

describe("DeploymentOutcomePrompt", () => {
  it("shows the card once the api says the deployment is eligible", () => {
    const { DeploymentOutcomeCard, markPrompted } = setup({ outcome: { outcome: "live" }, deploymentName: "sdxl-image-api" });

    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(DeploymentOutcomeCard.mock.lastCall?.[0]).toMatchObject({ outcome: "live", deploymentName: "sdxl-image-api", isSending: false });
    expect(markPrompted).toHaveBeenCalledWith("11");
  });

  it("asks the api about the deployment only while it can be asked about", () => {
    const { useFeedbackOutcomePromptQuery } = setup({ outcome: { outcome: "live" } });

    expect(useFeedbackOutcomePromptQuery).toHaveBeenCalledWith("11", { enabled: true });
  });

  it("shows nothing while the feedback loop is off", () => {
    const { useFeedbackOutcomePromptQuery, useFlag } = setup({ outcome: { outcome: "live" }, isEnabled: false });

    expect(useFlag).toHaveBeenCalledWith("user_feedback_loop");
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(useFeedbackOutcomePromptQuery).toHaveBeenCalledWith("11", { enabled: false });
  });

  it("takes the card down when the feedback loop is switched off after it was shown", () => {
    const { useFlag, rerenderPrompt } = setup({ outcome: { outcome: "live" } });
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();

    useFlag.mockReturnValue(false);
    rerenderPrompt();

    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("shows nothing without an outcome", () => {
    const { useFeedbackOutcomePromptQuery } = setup({ outcome: undefined });

    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(useFeedbackOutcomePromptQuery).toHaveBeenCalledWith("11", { enabled: false });
  });

  it("shows nothing for a deployment already asked about this session", () => {
    const { useFeedbackOutcomePromptQuery } = setup({ outcome: { outcome: "live" }, recorded: { outcome: "live", isPrompted: true } });

    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(useFeedbackOutcomePromptQuery).toHaveBeenCalledWith("11", { enabled: false });
  });

  it("shows nothing when the api says the deployment is not eligible", () => {
    const { markPrompted } = setup({ outcome: { outcome: "live" }, prompt: { dseq: "11", eligible: false, reason: "cooldown" } });

    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(markPrompted).not.toHaveBeenCalled();
  });

  it("ignores an eligibility answer about another deployment", () => {
    const { markPrompted } = setup({ outcome: { outcome: "live" }, prompt: { dseq: "12", eligible: true, reason: null } });

    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(markPrompted).not.toHaveBeenCalled();
  });

  it("records Not now as a dismissed answer and hides the card", async () => {
    const { createFeedback } = setup({ outcome: { outcome: "failed", failureReason: "No bids" } });

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(createFeedback).toHaveBeenCalledWith({
      data: { kind: "deployment_outcome", dseq: "11", outcome: "failed", failureReason: "No bids", page: "/deployments/11", dismissed: true }
    });
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("sends the rating, thanks the user and hides the card", async () => {
    const { createFeedback, enqueueSnackbar } = setup({ outcome: { outcome: "live" } });

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(createFeedback).toHaveBeenCalledWith(
      {
        data: {
          kind: "deployment_outcome",
          dseq: "11",
          outcome: "live",
          failureReason: undefined,
          page: "/deployments/11",
          dismissed: false,
          rating: 4,
          message: "Smooth"
        }
      },
      expect.anything()
    );
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Thanks for the feedback" }) }), {
      variant: "success"
    });
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("hides the card quietly when the deployment was already answered elsewhere", async () => {
    const { enqueueSnackbar } = setup({ outcome: { outcome: "live" }, sendError: new ApiError(409, { code: "feedback_already_answered" }, "POST → 409") });

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("tells the user to come back tomorrow once over the daily limit", async () => {
    const { enqueueSnackbar } = setup({ outcome: { outcome: "live" }, sendError: new ApiError(429, { code: "feedback_limit" }, "POST → 429") });

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "You've sent a lot of feedback today", subTitle: "Try again tomorrow." }) }),
      { variant: "warning" }
    );
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("keeps the card to retry when sending fails", async () => {
    const { enqueueSnackbar } = setup({ outcome: { outcome: "live" }, sendError: new Error("network down") });

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't send your feedback" }) }), {
      variant: "error"
    });
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  function setup(input: {
    outcome: KnownDeploymentOutcome | undefined;
    deploymentName?: string;
    isEnabled?: boolean;
    recorded?: RecordedDeploymentOutcome;
    prompt?: { dseq: string; eligible: boolean; reason: "already_answered" | "cooldown" | null };
    sendError?: unknown;
  }) {
    const markPrompted = vi.fn();
    const enqueueSnackbar = vi.fn();
    const createFeedback = vi.fn((_body: unknown, options?: { onSuccess?: () => void; onError?: (error: unknown) => void }) => {
      if (input.sendError) options?.onError?.(input.sendError);
      else options?.onSuccess?.();
    });
    const useFeedbackOutcomePromptQuery = vi.fn(() =>
      mock<ReturnType<typeof DEPENDENCIES.useFeedbackOutcomePromptQuery>>({ data: input.prompt ?? { dseq: "11", eligible: true, reason: null } })
    );
    const DeploymentOutcomeCard = vi.fn(({ onSend, onDismiss }: CardProps) => (
      <div>
        <button onClick={() => onSend({ rating: 4, message: "Smooth" })}>Send</button>
        <button onClick={onDismiss}>Dismiss</button>
      </div>
    ));

    const useFlag = vi.fn(() => input.isEnabled ?? true);
    const dependencies = MockComponents(DEPENDENCIES, {
      useFlag,
      useDeploymentOutcomes: () => ({
        outcomes: input.recorded ? { "11": input.recorded } : ({} as Record<string, RecordedDeploymentOutcome>),
        recordOutcome: vi.fn(),
        markPrompted
      }),
      useFeedbackOutcomePromptQuery: useFeedbackOutcomePromptQuery as unknown as typeof DEPENDENCIES.useFeedbackOutcomePromptQuery,
      useCreateFeedbackMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCreateFeedbackMutation>>({
          mutate: createFeedback as unknown as ReturnType<typeof DEPENDENCIES.useCreateFeedbackMutation>["mutate"],
          isPending: false
        }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      usePathname: () => "/deployments/11",
      DeploymentOutcomeCard
    });

    const renderPrompt = () => <DeploymentOutcomePrompt dseq="11" outcome={input.outcome} deploymentName={input.deploymentName} dependencies={dependencies} />;
    const { rerender } = render(renderPrompt());
    const rerenderPrompt = () => rerender(renderPrompt());

    return { rerenderPrompt, markPrompted, createFeedback, enqueueSnackbar, useFeedbackOutcomePromptQuery, useFlag, DeploymentOutcomeCard };
  }
});
