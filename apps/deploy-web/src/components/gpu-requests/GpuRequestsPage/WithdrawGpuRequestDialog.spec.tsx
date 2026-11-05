import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DEPENDENCIES } from "./WithdrawGpuRequestDialog";
import { WithdrawGpuRequestDialog } from "./WithdrawGpuRequestDialog";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildHardwareRequest, buildHardwareRequestSpec } from "@tests/seeders/hardwareRequest";

describe(WithdrawGpuRequestDialog.name, () => {
  it("names the request it withdraws", () => {
    setup({});

    expect(screen.getByRole("dialog", { name: "Withdraw this request?" })).toHaveAccessibleDescription(
      "We'll stop sourcing 2× A100 for you. You can send a new request any time."
    );
  });

  it("withdraws the request and confirms it", async () => {
    const { user, withdrawRequest, enqueueSnackbar, onClose, analyticsService } = setup({});
    withdrawRequest.mockImplementation((input, options) => options?.onSuccess?.(mock(), input, undefined));

    await user.click(screen.getByRole("button", { name: "Withdraw request" }));

    expect(withdrawRequest).toHaveBeenCalledWith({ id: "request-1" }, expect.anything());
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Request withdrawn", subTitle: "We've let the team know." }) }),
      { variant: "success" }
    );
    expect(onClose).toHaveBeenCalled();
    expect(analyticsService.track).toHaveBeenCalledWith("gpu_request_withdrawn", {
      category: "deployments",
      hardwareRequestId: "request-1",
      status: "sourcing"
    });
  });

  it("reports a refused withdrawal and closes", async () => {
    const { user, withdrawRequest, enqueueSnackbar, onClose, analyticsService } = setup({});
    withdrawRequest.mockImplementation((input, options) => options?.onError?.(new Error("already accepted"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Withdraw request" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ title: "Couldn't withdraw your request", subTitle: "It may have moved on already. Check its status and try again." })
      }),
      { variant: "error" }
    );
    expect(onClose).toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it("keeps the request on Keep request", async () => {
    const { user, withdrawRequest, onClose } = setup({});

    await user.click(screen.getByRole("button", { name: "Keep request" }));

    expect(onClose).toHaveBeenCalled();
    expect(withdrawRequest).not.toHaveBeenCalled();
  });

  it("stays open on Escape while withdrawing", async () => {
    const { user, onClose } = setup({ isPending: true });

    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Keep request" })).toBeDisabled();
  });

  it("closes on Escape otherwise", async () => {
    const { user, onClose } = setup({});

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  function setup(input: { isPending?: boolean }) {
    const withdrawRequest = vi.fn<ReturnType<typeof DEPENDENCIES.useWithdrawHardwareRequestMutation>["mutate"]>();
    const enqueueSnackbar = vi.fn();
    const onClose = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const dependencies: typeof DEPENDENCIES = {
      useWithdrawHardwareRequestMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useWithdrawHardwareRequestMutation>>({ mutate: withdrawRequest, isPending: input.isPending ?? false }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService })
    };
    const request = buildHardwareRequest({
      id: "request-1",
      status: "sourcing",
      spec: buildHardwareRequestSpec({ gpu: { model: "A100", count: 2, interconnect: "none" } })
    });

    render(<WithdrawGpuRequestDialog request={request} onClose={onClose} dependencies={dependencies} />);

    return { user: userEvent.setup(), withdrawRequest, enqueueSnackbar, onClose, analyticsService };
  }
});
