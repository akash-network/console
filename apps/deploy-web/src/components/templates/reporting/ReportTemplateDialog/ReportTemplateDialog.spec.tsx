import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES, ReportedTemplate } from "./ReportTemplateDialog";
import { ReportTemplateDialog } from "./ReportTemplateDialog";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type ReportMutation = ReturnType<typeof DEPENDENCIES.useReportTemplateMutation>;

const TEMPLATE: ReportedTemplate = {
  id: "tpl-webui",
  title: "Open WebUI + vLLM",
  currentVersion: { version: 4 },
  publisher: { name: "Lambda Garage" }
};
const HOSTILE_MARKUP = '<img src=x onerror="alert(1)"><a href="javascript:alert(1)">[click](javascript:alert(1))</a>';
const RATE_LIMIT_MESSAGE = "You reached the limit of 10 reports per day. Try again in 3 hours.";

describe(ReportTemplateDialog.name, () => {
  it("names the template, its version and its publisher", () => {
    setup({});

    expect(screen.getByRole("dialog", { name: "Report template" })).toBeInTheDocument();
    expect(screen.getByText("Open WebUI + vLLM · v4 · by Lambda Garage")).toBeInTheDocument();
  });

  it("names only what it knows about a template without a version or a publisher", () => {
    setup({ template: { ...TEMPLATE, currentVersion: null, publisher: null } });

    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Open WebUI + vLLM");
    expect(screen.getByText(/The publisher won't see who sent it/)).toBeInTheDocument();
  });

  it("offers every reason the API accepts in plain language, with none picked", () => {
    setup({});

    const reasons = screen.getAllByRole("radio");
    expect(screen.getByRole("radiogroup", { name: "What's wrong?" })).toBeInTheDocument();
    expect(reasons.map(reason => reason.getAttribute("value"))).toEqual(["malware_or_miner", "leaks_secrets", "impersonation", "spam", "broken", "other"]);
    expect(reasons.every(reason => reason.getAttribute("aria-checked") === "false")).toBe(true);
    expect(screen.getByRole("radio", { name: /Malware or miner.*Runs a crypto miner/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Leaks secrets.*keys, tokens or passwords/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Impersonation.*Pretends to be Akash/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Spam.*link farms/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Broken.*Doesn't deploy/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Other.*Something else/ })).toBeInTheDocument();
  });

  it("waits for a reason before it can be sent", async () => {
    const { user, sendReport } = setup({});

    expect(screen.getByRole("button", { name: "Send report" })).toBeDisabled();
    fireEvent.submit(screen.getByRole("textbox", { name: /Details/ }).closest("form") as HTMLFormElement);
    expect(sendReport).not.toHaveBeenCalled();

    await user.click(screen.getByRole("radio", { name: /Spam/ }));

    expect(screen.getByRole("radio", { name: /Spam/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Send report" })).toBeEnabled();
  });

  it("counts the details against the 1000 character limit", () => {
    setup({});
    const details = screen.getByRole("textbox", { name: /Details/ });

    expect(details).toHaveAttribute("maxLength", "1000");
    expect(details).toHaveAccessibleDescription("Links and file paths help us check faster.");
    expect(screen.getByLabelText("0 of 1000 characters used")).toHaveTextContent("0 / 1000");

    fireEvent.change(details, { target: { value: "Starts xmrig in the background" } });

    expect(screen.getByLabelText("30 of 1000 characters used")).toHaveTextContent("30 / 1000");
  });

  it("says staff review reports and the publisher is not told who sent one", () => {
    setup({});

    expect(screen.getByText(/Akash staff review every report\. Lambda Garage won't see who sent it\./)).toBeInTheDocument();
  });

  it("sends the reason with trimmed details and thanks the reporter", async () => {
    const { user, sendReport, onClose } = setup({});

    await user.click(screen.getByRole("radio", { name: /Malware or miner/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Details/ }), { target: { value: "  Starts xmrig\nfrom a pastebin link  " } });
    await user.click(screen.getByRole("button", { name: "Send report" }));

    expect(sendReport).toHaveBeenCalledWith({ id: "tpl-webui", data: { reason: "malware_or_miner", details: "Starts xmrig\nfrom a pastebin link" } });
    expect(screen.getByRole("status")).toHaveTextContent("Thanks, your report was sent");
    expect(screen.getByRole("status")).toHaveTextContent("Akash staff will look at it. Lambda Garage is not told who reported the template.");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send report" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sends no details when they are left blank", async () => {
    const { user, sendReport } = setup({});

    await user.click(screen.getByRole("radio", { name: /Broken/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Details/ }), { target: { value: "   " } });
    await user.click(screen.getByRole("button", { name: "Send report" }));

    expect(sendReport).toHaveBeenCalledWith({ id: "tpl-webui", data: { reason: "broken", details: undefined } });
  });

  it("tells someone who already reported this version so, without an error", async () => {
    const { user } = setup({ sendError: refusalOf(409, "template_already_reported") });

    await sendSpamReport(user);

    expect(screen.getByRole("status")).toHaveTextContent("You already reported v4");
    expect(screen.getByRole("status")).toHaveTextContent("Akash staff have your report.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send report" })).not.toBeInTheDocument();
  });

  it("says the version was already reported when the template has no version number to name", async () => {
    const { user } = setup({ template: { ...TEMPLATE, currentVersion: null }, sendError: refusalOf(409, "template_already_reported") });

    await sendSpamReport(user);

    expect(screen.getByRole("status")).toHaveTextContent("You already reported this version");
  });

  it.each([
    [409, "template_not_reportable", "This template can't be reported right now", "It is no longer public"],
    [403, "template_report_own_organization", "You can't report your own organization's template", "change or delete it instead"],
    [404, "not_found", "You can no longer open this template", "It may have been made private"],
    [403, "organization_forbidden", "You can no longer open this template", "It may have been made private"]
  ])("ends on a calm notice for a %i %s", async (status, code, title, message) => {
    const { user, onTemplateRemoved, onSignedOut } = setup({ sendError: refusalOf(status, code) });

    await sendSpamReport(user);

    expect(screen.getByRole("status")).toHaveTextContent(title);
    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(onTemplateRemoved).not.toHaveBeenCalled();
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it("says a removed template is gone and tells the page behind it", async () => {
    const { user, onTemplateRemoved } = setup({
      sendError: new ApiError(410, { code: "template_removed", message: "This template was removed", data: { title: "Open WebUI + vLLM" } }, "410")
    });

    await sendSpamReport(user);

    expect(screen.getByRole("status")).toHaveTextContent("This template was already removed");
    expect(screen.getByRole("status")).toHaveTextContent("There is nothing left to report.");
    expect(onTemplateRemoved).toHaveBeenCalledTimes(1);
  });

  it("shows the server's wording of a rate limit and keeps the report to send later", async () => {
    const { user } = setup({ sendError: new ApiError(429, { code: "template_rate_limited", message: RATE_LIMIT_MESSAGE }, "429") });

    fireEvent.change(screen.getByRole("textbox", { name: /Details/ }), { target: { value: "Starts xmrig" } });
    await sendSpamReport(user);

    expect(screen.getByRole("alert")).toHaveTextContent(RATE_LIMIT_MESSAGE);
    expect(screen.getByRole("radio", { name: /Spam/ })).toBeChecked();
    expect(screen.getByRole("textbox", { name: /Details/ })).toHaveValue("Starts xmrig");
    expect(screen.getByRole("button", { name: "Send report" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("asks for readable details when the report is refused as invalid", async () => {
    const { user } = setup({ sendError: refusalOf(400, "validation_error") });

    await sendSpamReport(user);

    expect(screen.getByRole("alert")).toHaveTextContent("The report wasn't accepted. Remove unusual characters from the details and try again.");
  });

  it.each([
    ["a server error", new ApiError(503, { message: "Unavailable" }, "503")],
    ["a network failure", new TypeError("Failed to fetch")]
  ])("offers another try after %s", async (_, sendError) => {
    const { user } = setup({ sendError });

    await sendSpamReport(user);

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't send the report. Try again in a moment.");
    expect(screen.getByRole("button", { name: "Send report" })).toBeEnabled();
  });

  it("clears the last failure when the report is sent again", async () => {
    const { user, sendReport } = setup({ sendError: new ApiError(503, null, "503") });
    await sendSpamReport(user);
    sendReport.mockResolvedValueOnce({ data: { id: "report-1", reason: "spam", createdAt: "2026-11-19T10:00:00.000Z" } });

    await user.click(screen.getByRole("button", { name: "Send report" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Thanks, your report was sent");
  });

  it("hands a signed-out reporter to sign-in without showing a failure", async () => {
    const { user, onSignedOut, onClose } = setup({ sendError: new ApiError(401, { message: "Unauthorized" }, "401") });

    await sendSpamReport(user);

    expect(onSignedOut).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("locks the form while the report is on its way", () => {
    const { onClose, sendReport } = setup({ isSending: true });

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Send report/ })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Details/ })).toBeDisabled();
    expect(screen.getAllByRole("radio").every(reason => reason.hasAttribute("disabled"))).toBe(true);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.submit(screen.getByRole("textbox", { name: /Details/ }).closest("form") as HTMLFormElement);

    expect(onClose).not.toHaveBeenCalled();
    expect(sendReport).not.toHaveBeenCalled();
  });

  it("closes on Cancel and on Escape", async () => {
    const { user, onClose } = setup({});

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows markup in the title, the publisher name and the details as text", async () => {
    const { user } = setup({ template: { ...TEMPLATE, title: HOSTILE_MARKUP, publisher: { name: HOSTILE_MARKUP } } });

    fireEvent.change(screen.getByRole("textbox", { name: /Details/ }), { target: { value: HOSTILE_MARKUP } });

    expect(screen.getByText(`${HOSTILE_MARKUP} · v4 · by ${HOSTILE_MARKUP}`)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Details/ })).toHaveValue(HOSTILE_MARKUP);
    expect(screen.getByRole("dialog").querySelector("img, a")).not.toBeInTheDocument();

    await sendSpamReport(user);

    expect(screen.getByRole("status")).toHaveTextContent(`${HOSTILE_MARKUP} is not told who reported the template.`);
    expect(screen.getByRole("dialog").querySelector("img, a")).not.toBeInTheDocument();
  });

  it("shows markup in a rate limit message as text", async () => {
    const { user } = setup({ sendError: new ApiError(429, { code: "template_rate_limited", message: HOSTILE_MARKUP }, "429") });

    await sendSpamReport(user);

    expect(screen.getByRole("alert")).toHaveTextContent(HOSTILE_MARKUP);
    expect(screen.getByRole("dialog").querySelector("img, a")).not.toBeInTheDocument();
  });

  async function sendSpamReport(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("radio", { name: /Spam/ }));
    await user.click(screen.getByRole("button", { name: "Send report" }));
  }

  function refusalOf(status: number, code: string) {
    return new ApiError(status, { code, message: "Refused" }, String(status));
  }

  function setup(input: { template?: ReportedTemplate; sendError?: unknown; isSending?: boolean }) {
    const onClose = vi.fn();
    const onSignedOut = vi.fn();
    const onTemplateRemoved = vi.fn();
    const sendReport = vi.fn<ReportMutation["mutateAsync"]>(async () => {
      if (input.sendError) throw input.sendError;
      return { data: { id: "report-1", reason: "spam", createdAt: "2026-11-19T10:00:00.000Z" } };
    });
    const reportMutation = mock<ReportMutation>({ mutateAsync: sendReport, isPending: input.isSending ?? false });

    render(
      <ReportTemplateDialog
        template={input.template ?? TEMPLATE}
        onClose={onClose}
        onSignedOut={onSignedOut}
        onTemplateRemoved={onTemplateRemoved}
        dependencies={{ useReportTemplateMutation: () => reportMutation }}
      />
    );

    return { user: userEvent.setup(), onClose, onSignedOut, onTemplateRemoved, sendReport };
  }
});
