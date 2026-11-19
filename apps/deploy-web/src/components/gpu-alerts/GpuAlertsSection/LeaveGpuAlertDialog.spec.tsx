import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DEPENDENCIES } from "./LeaveGpuAlertDialog";
import { LeaveGpuAlertDialog } from "./LeaveGpuAlertDialog";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(LeaveGpuAlertDialog.name, () => {
  it("confirms that emails for this setup stop", () => {
    setup();

    expect(screen.getByRole("dialog", { name: "Leave this alert?" })).toHaveAccessibleDescription(
      "You'll stop getting emails when NVIDIA H100 frees up. You can join again any time."
    );
  });

  it("leaves the waitlist after confirming", async () => {
    const { user, leave, enqueueSnackbar, onClose, analyticsService } = setup();
    leave.mockImplementation((input, options) => options?.onSuccess?.(mock(), input, undefined));

    await user.click(screen.getByRole("button", { name: "Leave alert" }));

    expect(leave).toHaveBeenCalledWith({ id: "entry-1" }, expect.anything());
    expect(analyticsService.track).toHaveBeenCalledWith("gpu_alert_left", { category: "deployments", model: "h100", gpuCount: 2 });
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "You left the alert" }) }), {
      variant: "success"
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("says the alert has already ended when it is gone", async () => {
    const { user, leave, enqueueSnackbar, onClose, analyticsService } = setup();
    leave.mockImplementation((input, options) => options?.onError?.(new ApiError(404, undefined, "gone"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Leave alert" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "This alert has already ended" }) }), {
      variant: "info"
    });
    expect(analyticsService.track).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("reports other failures as errors", async () => {
    const { user, leave, enqueueSnackbar } = setup();
    leave.mockImplementation((input, options) => options?.onError?.(new Error("boom"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Leave alert" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't leave the alert" }) }), {
      variant: "error"
    });
  });

  it("closes without leaving", async () => {
    const { user, leave, onClose } = setup();

    await user.click(screen.getByRole("button", { name: "Keep alert" }));

    expect(leave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  function setup() {
    const leave = vi.fn();
    const enqueueSnackbar = vi.fn();
    const onClose = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const dependencies: typeof DEPENDENCIES = {
      useLeaveGpuWaitlistMutation: () =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLeaveGpuWaitlistMutation>>(), { mutate: leave, isPending: false }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService })
    };

    render(<LeaveGpuAlertDialog entry={{ id: "entry-1", model: "h100", gpuCount: 2 }} label="NVIDIA H100" onClose={onClose} dependencies={dependencies} />);

    return { user: userEvent.setup(), leave, enqueueSnackbar, onClose, analyticsService };
  }
});
