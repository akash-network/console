import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./ApiKeyUsageExample";
import { API_KEY_USAGE_SCRIPT_LINES, ApiKeyUsageExample } from "./ApiKeyUsageExample";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("ApiKeyUsageExample", () => {
  it("shows the whole script line by line", () => {
    setup();

    expect(screen.getByLabelText("API key usage script").textContent).toBe(API_KEY_USAGE_SCRIPT_LINES.join("\n"));
  });

  it("walks through creating a deployment, waiting for bids, leasing and closing", () => {
    setup();

    const script = screen.getByLabelText("API key usage script");
    expect(script).toHaveTextContent('DSEQ=$(curl -s -X POST "$API/v1/deployments"');
    expect(script).toHaveTextContent('until BID=$(curl -s "$API/v1/bids?dseq=$DSEQ"');
    expect(script).toHaveTextContent('curl -s -X POST "$API/v1/leases"');
    expect(script).toHaveTextContent('curl -s -X DELETE "$API/v1/deployments/$DSEQ"');
  });

  it("marks comments, commands and strings for highlighting", () => {
    setup();

    const script = screen.getByLabelText("API key usage script");
    expect(script.querySelector('[data-token="comment"]')).toHaveTextContent("# Authenticate every request with the x-api-key header");
    expect(script.querySelector('[data-token="command"]')).toHaveTextContent("export");
    expect(script.querySelector('[data-token="string"]')).toHaveTextContent('"<your-api-key>"');
  });

  it("copies the script", async () => {
    const { user, enqueueSnackbar, writeText } = setup();

    await user.click(screen.getByRole("button", { name: "Copy script" }));

    expect(writeText).toHaveBeenCalledWith(API_KEY_USAGE_SCRIPT_LINES.join("\n"));
    await vi.waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Script copied to clipboard" }) }), {
        variant: "success",
        autoHideDuration: 1500
      })
    );
  });

  it("tells the user when the script can't be copied", async () => {
    const { user, enqueueSnackbar, writeText } = setup();
    writeText.mockRejectedValue(new Error("denied"));

    await user.click(screen.getByRole("button", { name: "Copy script" }));

    await vi.waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't copy the script" }) }), {
        variant: "error"
      })
    );
    expect(enqueueSnackbar).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "success" }));
  });

  it("sits in the Using your keys section", () => {
    setup();

    expect(within(screen.getByRole("region", { name: "Using your keys" })).getByLabelText("API key usage script")).toBeInTheDocument();
  });

  function setup() {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    writeText.mockClear();
    const enqueueSnackbar = vi.fn();
    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>(), { enqueueSnackbar });

    render(<ApiKeyUsageExample dependencies={{ useSnackbar }} />);

    return { user, enqueueSnackbar, writeText };
  }
});
