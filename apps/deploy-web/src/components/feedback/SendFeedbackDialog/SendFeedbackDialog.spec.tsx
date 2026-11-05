import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./SendFeedbackDialog";
import { SendFeedbackDialog } from "./SendFeedbackDialog";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("SendFeedbackDialog", () => {
  it("offers bug, feature request and other with the consent line", () => {
    setup();

    expect(screen.getByRole("dialog", { name: "Send feedback" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map(radio => radio.textContent)).toEqual(["Bug", "Feature request", "Other"]);
    expect(screen.getByText(/Sent to the Akash team with the page you're on/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy-policy");
  });

  it("keeps Send feedback disabled until a type is picked and a message written", async () => {
    setup();
    const sendButton = screen.getByRole("button", { name: "Send feedback" });

    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "Add a dark mode for logs");
    expect(sendButton).toBeDisabled();

    await userEvent.click(screen.getByRole("radio", { name: "Feature request" }));
    expect(sendButton).toBeEnabled();

    await userEvent.clear(screen.getByRole("textbox", { name: "Message" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "   ");
    expect(sendButton).toBeDisabled();
  });

  it("sends the feedback with the page, confirms and closes", async () => {
    const { createFeedback, enqueueSnackbar, onClose } = setup();

    await fillAndSend();

    expect(createFeedback).toHaveBeenCalledWith(
      { data: { kind: "general", category: "bug", message: "Logs stop after a minute", page: "/deployments/11" } },
      expect.anything()
    );
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ title: "Thanks, the team got your feedback", subTitle: "We read every message, but we can't reply to each one." })
      }),
      { variant: "success" }
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the picked type when it is clicked again", async () => {
    const { createFeedback } = setup();

    await userEvent.click(screen.getByRole("radio", { name: "Other" }));
    await userEvent.click(screen.getByRole("radio", { name: "Other" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "Hi");
    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    expect(createFeedback).toHaveBeenCalledWith({ data: expect.objectContaining({ category: "other" }) }, expect.anything());
  });

  it("tells the user to come back tomorrow once over the daily limit", async () => {
    const { enqueueSnackbar, onClose } = setup({ sendError: new ApiError(429, { code: "feedback_limit" }, "POST → 429") });

    await fillAndSend();

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "You've sent a lot of feedback today", subTitle: "Try again tomorrow." }) }),
      { variant: "warning" }
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the dialog open to retry when sending fails", async () => {
    const { enqueueSnackbar, onClose } = setup({ sendError: new Error("network down") });

    await fillAndSend();

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't send your feedback", subTitle: "Try again in a moment." }) }),
      { variant: "error" }
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from Cancel", async () => {
    const { onClose } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("blocks closing while sending", () => {
    setup({ isSending: true });

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Send feedback/ })).toBeDisabled();
  });

  async function fillAndSend() {
    await userEvent.click(screen.getByRole("radio", { name: "Bug" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "  Logs stop after a minute ");
    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
  }

  function setup(input: { sendError?: unknown; isSending?: boolean } = {}) {
    const onClose = vi.fn();
    const enqueueSnackbar = vi.fn();
    const createFeedback = vi.fn((_body: unknown, options?: { onSuccess?: () => void; onError?: (error: unknown) => void }) => {
      if (input.sendError) options?.onError?.(input.sendError);
      else options?.onSuccess?.();
    });
    const dependencies: typeof DEPENDENCIES = {
      useCreateFeedbackMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCreateFeedbackMutation>>({
          mutate: createFeedback as unknown as ReturnType<typeof DEPENDENCIES.useCreateFeedbackMutation>["mutate"],
          isPending: input.isSending ?? false
        }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      usePathname: () => "/deployments/11"
    };

    render(<SendFeedbackDialog onClose={onClose} dependencies={dependencies} />);

    return { onClose, enqueueSnackbar, createFeedback };
  }
});
