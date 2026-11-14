import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ASSISTANT_REPORT_CONSENT_COPY } from "../assistantReportConsentCopy";
import type { DEPENDENCIES } from "./ReportProblemDialog";
import { MAX_PROBLEM_REPORT_NOTE_LENGTH, ReportProblemDialog } from "./ReportProblemDialog";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ReportProblemDialog.name, () => {
  it("asks for an optional note and shows the report consent line", () => {
    setup();

    expect(screen.getByRole("dialog", { name: "Report a problem" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "What went wrong?" })).toHaveAttribute("maxLength", String(MAX_PROBLEM_REPORT_NOTE_LENGTH));
    expect(screen.getByText(ASSISTANT_REPORT_CONSENT_COPY.line)).toBeInTheDocument();
    expect(ASSISTANT_REPORT_CONSENT_COPY.line).toBe("This conversation will be sent to the Akash team to fix the problem. Secrets are removed.");
    expect(screen.getByRole("button", { name: "Send report" })).toBeEnabled();
  });

  it("sends the note, confirms and closes", async () => {
    const { onSend, onClose, enqueueSnackbar } = setup();

    await userEvent.type(screen.getByRole("textbox", { name: "What went wrong?" }), "It named a GPU nobody offers");
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(onSend).toHaveBeenCalledWith("It named a GPU nobody offers");
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Thanks, the team got your report", subTitle: "We'll look into what went wrong." }) }),
      { variant: "success" }
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("sends a report without a note", async () => {
    const { onSend } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(onSend).toHaveBeenCalledWith("");
  });

  it("stays open with an error the user can retry from when sending fails", async () => {
    const { onSend, onClose, enqueueSnackbar } = setup({ sendError: new ApiError(500, "error", "x") });

    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't send your report. Try again in a moment.");
    expect(onClose).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();

    onSend.mockResolvedValueOnce(undefined);
    await userEvent.click(screen.getByRole("button", { name: /Send report/ }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says when the user reached today's report limit", async () => {
    setup({ sendError: new ApiError(429, { code: "assistant_report_limit" }, "x") });

    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You've sent a lot of reports today. Try again tomorrow.");
  });

  it("cannot be sent twice or closed while it is sending", async () => {
    const sending = Promise.withResolvers<void>();
    const { onSend, onClose } = setup();
    onSend.mockReturnValue(sending.promise);

    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(onSend).toHaveBeenCalledTimes(1);

    sending.resolve();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("closes on Cancel without sending", async () => {
    const { onSend, onClose } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("closes from its close button", async () => {
    const { onClose } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  function setup(input: { sendError?: unknown } = {}) {
    const onClose = vi.fn();
    const enqueueSnackbar = vi.fn();
    const onSend = vi.fn(async (_note: string) => {
      if (input.sendError) throw input.sendError;
    });
    const dependencies: typeof DEPENDENCIES = {
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };

    render(<ReportProblemDialog onSend={onSend} onClose={onClose} dependencies={dependencies} />);

    return { onSend, onClose, enqueueSnackbar };
  }
});
