import { StrictMode } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DEPENDENCIES } from "./GpuAlertsSection";
import { GpuAlertsSection } from "./GpuAlertsSection";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type KeepOptions = NonNullable<Parameters<ReturnType<typeof DEPENDENCIES.useKeepGpuWaitlistEntryMutation>["mutate"]>[1]>;
type KeepSuccess = Parameters<NonNullable<KeepOptions["onSuccess"]>>;
type KeepFailure = Parameters<NonNullable<KeepOptions["onError"]>>;

type Entry = NonNullable<ReturnType<typeof DEPENDENCIES.useGpuWaitlistQuery>["data"]>[number];

const buildEntry = (overrides?: Partial<Entry>): Entry => ({
  id: "entry-1",
  vendor: "nvidia",
  model: "h100",
  memory: null,
  interface: null,
  gpuCount: 2,
  source: "gpu_menu",
  status: "waiting",
  placeInLine: 4,
  joinedAt: "2026-11-03T12:00:00.000Z",
  lastNotifiedAt: null,
  ...overrides
});

describe(GpuAlertsSection.name, () => {
  it("lists waitlists with their place in line", () => {
    setup({
      entries: [buildEntry({ placeInLine: 4, lastNotifiedAt: "2026-11-10T12:00:00.000Z" }), buildEntry({ id: "entry-2", model: "a100", placeInLine: 9 })]
    });

    expect(screen.getByText("#4 in line · Joined Nov 3, 2026 · Last emailed Nov 10, 2026")).toBeInTheDocument();
    expect(screen.getByText("#9 in line · Joined Nov 3, 2026 · Not emailed yet")).toBeInTheDocument();
    expect(screen.getByText("H100 · 2 GPUs")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Leave" })).toHaveLength(2);
  });

  it("shows an empty state", () => {
    setup({ entries: [] });

    expect(screen.getByRole("heading", { name: "No GPU alerts" })).toBeInTheDocument();
  });

  it("opens the leave dialog for the chosen alert", async () => {
    const { LeaveGpuAlertDialog } = setup({ entries: [buildEntry()] });

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));

    expect(LeaveGpuAlertDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({ entry: expect.objectContaining({ id: "entry-1" }), label: "H100 · 2 GPUs" }),
      expect.anything()
    );
    act(() => LeaveGpuAlertDialog.mock.lastCall![0].onClose());
    expect(screen.queryByText("Leave dialog")).not.toBeInTheDocument();
  });

  it("opens the leave dialog from the email link", () => {
    const { LeaveGpuAlertDialog, replace, enqueueSnackbar } = setup({
      entries: [buildEntry()],
      query: { leaveAlert: "entry-1" },
      asPath: "/gpu-requests?leaveAlert=entry-1"
    });

    expect(LeaveGpuAlertDialog).toHaveBeenLastCalledWith(expect.objectContaining({ entry: expect.objectContaining({ id: "entry-1" }) }), expect.anything());
    expect(replace).toHaveBeenCalledWith("/gpu-requests", undefined, { shallow: true });
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("says the alert has ended when the leave link names an unknown entry", () => {
    const { LeaveGpuAlertDialog, enqueueSnackbar, replace } = setup({
      entries: [buildEntry()],
      query: { leaveAlert: "gone" },
      asPath: "/gpu-requests?leaveAlert=gone"
    });

    expect(LeaveGpuAlertDialog).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "This alert has already ended" }) }), {
      variant: "info"
    });
    expect(replace).toHaveBeenCalledWith("/gpu-requests", undefined, { shallow: true });
  });

  it("waits for the list before handling the leave link", () => {
    const { LeaveGpuAlertDialog, replace } = setup({ entries: undefined, isLoading: true, query: { leaveAlert: "entry-1" } });

    expect(LeaveGpuAlertDialog).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps an alert from the email link once", () => {
    const { keepEntry, enqueueSnackbar, replace, analyticsService, rerender } = setup({
      entries: [buildEntry()],
      query: { keepAlert: "entry-1" },
      asPath: "/gpu-requests?keepAlert=entry-1"
    });
    rerender();

    expect(keepEntry).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/gpu-requests", undefined, { shallow: true });
    expect(analyticsService.track).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("confirms a kept alert", () => {
    const { keepEntry, enqueueSnackbar, analyticsService } = setup({ entries: [], query: { keepAlert: "entry-1" } });
    expect(keepEntry).toHaveBeenCalledOnce();
    expect(keepEntry).toHaveBeenCalledWith({ id: "entry-1" }, expect.anything());

    act(() =>
      keepEntry.mock.lastCall![1]!.onSuccess!(mock<KeepSuccess[0]>({ data: buildEntry({ placeInLine: 3 }) }), mock<KeepSuccess[1]>(), mock<KeepSuccess[2]>())
    );

    expect(analyticsService.track).toHaveBeenCalledWith("gpu_alert_kept", { category: "deployments", model: "h100", gpuCount: 2 });
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ subTitle: "You're #3 in line." }) }), {
      variant: "success"
    });
  });

  it("says the alert has ended when keeping it is refused with 404", () => {
    const { keepEntry, enqueueSnackbar } = setup({ entries: [], query: { keepAlert: "entry-1" } });

    act(() => keepEntry.mock.lastCall![1]!.onError!(new ApiError(404, undefined, "gone"), mock<KeepFailure[1]>(), mock<KeepFailure[2]>()));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "This alert has already ended" }) }), {
      variant: "info"
    });
  });

  it("reports other keep failures as errors", () => {
    const { keepEntry, enqueueSnackbar } = setup({ entries: [], query: { keepAlert: "entry-1" } });

    act(() => keepEntry.mock.lastCall![1]!.onError!(new Error("boom"), mock<KeepFailure[1]>(), mock<KeepFailure[2]>()));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't keep your alert" }) }), {
      variant: "error"
    });
  });

  it("keeps an alert once under StrictMode", () => {
    const { keepEntry } = setup({ entries: [buildEntry()], query: { keepAlert: "entry-1" }, strict: true });

    expect(keepEntry).toHaveBeenCalledOnce();
  });

  it("keeps unrelated params when dropping the handled one", () => {
    const { replace } = setup({ entries: [], query: { foo: "1", keepAlert: "x" }, asPath: "/gpu-requests?foo=1&keepAlert=x" });

    expect(replace).toHaveBeenCalledWith("/gpu-requests?foo=1", undefined, { shallow: true });
  });

  it("drops both params when a link carries keep and leave", () => {
    const { replace } = setup({
      entries: [buildEntry()],
      query: { keepAlert: "entry-1", leaveAlert: "entry-1" },
      asPath: "/gpu-requests?keepAlert=entry-1&leaveAlert=entry-1"
    });

    expect(replace).toHaveBeenLastCalledWith("/gpu-requests", undefined, { shallow: true });
  });

  it("waits for a refetch before handling the leave link", () => {
    const { LeaveGpuAlertDialog, replace, enqueueSnackbar } = setup({ entries: [buildEntry()], isFetching: true, query: { leaveAlert: "entry-1" } });

    expect(LeaveGpuAlertDialog).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("holds email links until the organization in the link is active", () => {
    const { keepEntry, LeaveGpuAlertDialog } = setup({ entries: [buildEntry()], query: { org: "team-1", keepAlert: "entry-1", leaveAlert: "entry-1" } });

    expect(keepEntry).not.toHaveBeenCalled();
    expect(LeaveGpuAlertDialog).not.toHaveBeenCalled();
  });

  function setup(input: { entries?: Entry[]; isLoading?: boolean; isFetching?: boolean; strict?: boolean; query?: Record<string, string>; asPath?: string }) {
    const replace = vi.fn();
    const enqueueSnackbar = vi.fn();
    const keepEntry = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const LeaveGpuAlertDialog = vi.fn<typeof DEPENDENCIES.LeaveGpuAlertDialog>(() => <div>Leave dialog</div>);
    const deps: typeof DEPENDENCIES = {
      LeaveGpuAlertDialog,
      useRouter: () =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useRouter>>(), {
          isReady: true,
          query: input.query ?? {},
          asPath: input.asPath ?? "/gpu-requests",
          replace
        }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService }),
      useGpuModels: () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useGpuModels>>(), { data: undefined }),
      useKeepGpuWaitlistEntryMutation: () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useKeepGpuWaitlistEntryMutation>>(), { mutate: keepEntry }),
      useGpuWaitlistQuery: () =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useGpuWaitlistQuery>>(), {
          data: input.entries,
          isLoading: input.isLoading ?? false,
          isError: false,
          isSuccess: !input.isLoading,
          isFetching: input.isFetching ?? !!input.isLoading
        })
    };

    const panel = <GpuAlertsSection dependencies={deps} />;
    const element = input.strict ? <StrictMode>{panel}</StrictMode> : panel;
    const { rerender } = render(element);

    return { replace, enqueueSnackbar, keepEntry, analyticsService, LeaveGpuAlertDialog, rerender: () => rerender(element) };
  }
});
