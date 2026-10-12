import type { ReactNode } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import { UrlService } from "@src/utils/urlUtils";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import { buildConfigureUrl } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES, ResumeResolution } from "./ResumeDeploymentGuard";
import { ResumeDeploymentGuard } from "./ResumeDeploymentGuard";

import { render, screen } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";

const PROVIDER = "akash1provider";

const RECORDED_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "API_KEY=ac-secret://s0_e0"\n';

const BLANKED_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "API_KEY="\n';

describe(ResumeDeploymentGuard.name, () => {
  it("renders a fresh start immediately when there is no dseq to resume", () => {
    const { getResume, replace } = setup({ intent: intentFor(undefined) });

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(getResume()).toEqual({ activeLeases: [] });
    expect(replace).not.toHaveBeenCalled();
  });

  it("holds the children behind a spinner while the deployment resolves", () => {
    setup({ intent: intentFor("555"), query: { isLoading: true } });

    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("strips the dseq and toasts when the resumed deployment no longer exists", () => {
    const intent = intentFor("555");
    const { replace, enqueueSnackbar } = setup({ intent, query: { error: new ApiError(404, { message: "Deployment not found" }, "GET → 404") } });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "warning" }));
    expect(replace).toHaveBeenCalledWith(buildConfigureUrl(intent, undefined, intent.bidStrategy));
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("renders a fresh start once the dseq has been stripped from the URL", () => {
    const { rerender, getResume } = setup({ intent: intentFor("555"), query: { error: new ApiError(404, {}, "GET → 404") } });

    rerender(intentFor(undefined));

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(getResume()).toEqual({ activeLeases: [] });
  });

  it("keeps rendering the fresh start after a not-found resume when a new deployment repopulates the dseq", () => {
    const { rerender, getResume } = setup({ intent: intentFor("555"), query: { error: new ApiError(404, {}, "GET → 404") } });

    // The URL clears (dseq stripped), then the fresh flow creates a new deployment and writes a dseq back. The guard has
    // latched a fresh start, so it must keep rendering the children rather than snapping back to the spinner.
    rerender(intentFor(undefined));
    rerender(intentFor("999"));

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(getResume()).toEqual({ activeLeases: [] });
  });

  it("resumes best-effort without stripping the dseq on a transient (non-404) error", () => {
    const { getResume, replace } = setup({ intent: intentFor("555"), query: { error: new ApiError(500, {}, "GET → 500") } });

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(getResume()).toEqual({ activeLeases: [] });
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to the detail page when the resumed deployment is closed", () => {
    const { replace } = setup({ intent: intentFor("555"), query: deployment({ state: "closed" }) });

    expect(replace).toHaveBeenCalledWith(UrlService.deploymentDetails("555"));
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("resumes quoting from scratch when the open deployment has no live leases", () => {
    const { getResume, replace } = setup({
      intent: intentFor("555"),
      query: deployment({ state: "active", leases: [{ id: { dseq: "555", gseq: 1, oseq: 1, provider: PROVIDER }, state: "closed" }] })
    });

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(getResume()).toEqual({ activeLeases: [] });
    expect(replace).not.toHaveBeenCalled();
  });

  it("hands over the definition the console recorded for the version the chain runs", () => {
    const { getResume } = setup({
      intent: intentFor("555"),
      query: deployment({ state: "active", hash: "v1", name: "my-app", consoleSettings: { sdl: RECORDED_SDL, manifestVersion: "v1" } })
    });

    expect(getResume()).toEqual({ activeLeases: [], recordedDefinition: { sdl: RECORDED_SDL, name: "my-app" } });
  });

  it("hands over the recorded definition without a name when the deployment carries none", () => {
    const { getResume } = setup({
      intent: intentFor("555"),
      query: deployment({ state: "active", hash: "v1", name: null, consoleSettings: { sdl: RECORDED_SDL, manifestVersion: "v1" } })
    });

    expect(getResume()).toEqual({ activeLeases: [], recordedDefinition: { sdl: RECORDED_SDL } });
    expect(getResume()?.recordedDefinition).not.toHaveProperty("name");
  });

  it("leaves out a definition recorded for a version the chain has moved past", () => {
    const { getResume } = setup({
      intent: intentFor("555"),
      query: deployment({ state: "active", hash: "v2", name: "my-app", consoleSettings: { sdl: RECORDED_SDL, manifestVersion: "v1" } })
    });

    expect(getResume()).not.toHaveProperty("recordedDefinition");
  });

  it("leaves out a recorded definition that blanked a value away", () => {
    const { getResume } = setup({
      intent: intentFor("555"),
      query: deployment({ state: "active", hash: "v1", name: "my-app", consoleSettings: { sdl: BLANKED_SDL, manifestVersion: "v1" } })
    });

    expect(getResume()).not.toHaveProperty("recordedDefinition");
  });

  it("reconstructs the live leases so the flow can re-send the manifest when it can resume", () => {
    const { getResume, replace } = setup({
      intent: intentFor("555"),
      canResume: true,
      query: deployment({
        state: "active",
        leases: [
          { id: { dseq: "555", gseq: 1, oseq: 2, provider: PROVIDER }, state: "active" },
          { id: { dseq: "555", gseq: 2, oseq: 1, provider: PROVIDER }, state: "closed" }
        ]
      })
    });

    expect(getResume()).toEqual({ activeLeases: [{ dseq: "555", gseq: 1, oseq: 2, provider: PROVIDER }] });
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects an already-leased deployment to the detail page when it cannot resume", () => {
    const { replace } = setup({
      intent: intentFor("555"),
      canResume: false,
      query: deployment({ state: "active", leases: [{ id: { dseq: "555", gseq: 1, oseq: 1, provider: PROVIDER }, state: "active" }] })
    });

    expect(replace).toHaveBeenCalledWith(UrlService.deploymentDetails("555"));
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  describe("when the activity center is on", () => {
    it("shows a deployment the feed reports still being created as in progress rather than missing", () => {
      const { replace, enqueueSnackbar } = setup({
        intent: intentFor("555"),
        isFollowingFeed: true,
        query: notFound(),
        feed: { activities: [createOf("777", "failed"), createOf("555", "pending")] }
      });

      expect(screen.getByRole("heading", { name: "Creating your deployment" })).toBeInTheDocument();
      expect(screen.getByText("You can leave this page. We'll let you know when it's ready.")).toBeInTheDocument();
      expect(screen.queryByTestId("child")).not.toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
      expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it("reads the deployment again until the chain has the one being created", () => {
      const { useGetDeployment } = setup({
        intent: intentFor("555"),
        isFollowingFeed: true,
        query: notFound(),
        feed: { activities: [createOf("555", "pending")] }
      });

      expect(useGetDeployment).toHaveBeenLastCalledWith("555", { isAwaitingCreate: true });
    });

    it("resumes choosing a provider once the chain has the created deployment, and stops reading it again", () => {
      const { respond, getResume, useGetDeployment } = setup({
        intent: intentFor("555"),
        isFollowingFeed: true,
        query: notFound(),
        feed: { activities: [createOf("555", "pending")] }
      });

      respond({ query: deployment({ state: "active" }), feed: { activities: [createOf("555", "succeeded")] } });

      expect(getResume()).toEqual({ activeLeases: [] });
      expect(screen.queryByRole("heading", { name: "Creating your deployment" })).not.toBeInTheDocument();
      expect(useGetDeployment).toHaveBeenLastCalledWith("555", { isAwaitingCreate: false });
    });

    it("keeps waiting on a create the feed reports done while the chain does not show it yet", () => {
      const { replace } = setup({ intent: intentFor("555"), isFollowingFeed: true, query: notFound(), feed: { activities: [createOf("555", "succeeded")] } });

      expect(screen.getByRole("heading", { name: "Creating your deployment" })).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it.each([
      { case: "whose create failed", activities: [createOf("555", "failed")] },
      {
        case: "the feed holds no create for",
        activities: [createOf("777", "pending"), buildActivity({ type: "deployment_close", status: "pending", meta: { dseq: "555" } })]
      }
    ])("treats a missing deployment $case as gone", ({ activities }) => {
      const intent = intentFor("555");
      const { replace, enqueueSnackbar } = setup({ intent, isFollowingFeed: true, query: notFound(), feed: { activities } });

      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "warning" }));
      expect(replace).toHaveBeenCalledWith(buildConfigureUrl(intent, undefined, intent.bidStrategy));
    });

    it("treats a missing deployment as gone when the feed cannot be read", () => {
      const { replace } = setup({ intent: intentFor("555"), isFollowingFeed: true, query: notFound(), feed: { isError: true } });

      expect(replace).toHaveBeenCalled();
    });

    it("waits for the feed before deciding a missing deployment is gone", () => {
      const { replace, useGetDeployment } = setup({ intent: intentFor("555"), isFollowingFeed: true, query: notFound(), feed: {} });

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Creating your deployment" })).not.toBeInTheDocument();
      expect(useGetDeployment).toHaveBeenLastCalledWith("555", { isAwaitingCreate: false });
      expect(replace).not.toHaveBeenCalled();
    });

    it("reads the feed only while a missing deployment is unresolved", () => {
      const { useLatestActivitiesQuery, useFlag, respond } = setup({ intent: intentFor("555"), isFollowingFeed: true, query: notFound(), feed: {} });
      const enabledWhileMissing = useLatestActivitiesQuery.mock.lastCall?.[0];

      respond({ query: deployment({ state: "active" }) });

      expect(useFlag).toHaveBeenCalledWith("notifications_activity_center");
      expect(enabledWhileMissing).toEqual({ enabled: true });
      expect(useLatestActivitiesQuery).toHaveBeenLastCalledWith({ enabled: false });
    });

    it("does not read the feed for a deployment the chain has", () => {
      const { useLatestActivitiesQuery } = setup({ intent: intentFor("555"), isFollowingFeed: true, query: { isLoading: true } });

      expect(useLatestActivitiesQuery).toHaveBeenLastCalledWith({ enabled: false });
    });
  });

  it("neither reads the feed nor waits on it for a missing deployment while the activity center is off", () => {
    const { useLatestActivitiesQuery, replace } = setup({ intent: intentFor("555"), query: notFound(), feed: { activities: [createOf("555", "pending")] } });

    expect(useLatestActivitiesQuery).toHaveBeenLastCalledWith({ enabled: false });
    expect(replace).toHaveBeenCalled();
  });

  function notFound() {
    return { error: new ApiError(404, { message: "Deployment not found" }, "GET → 404") };
  }

  function createOf(dseq: string, status: Activity["status"]) {
    return buildActivity({ type: "deployment_create", status, meta: { dseq } });
  }

  function intentFor(dseq: string | undefined): DeploymentIntent {
    return { sdlStrategy: "edit", bidStrategy: "select", dseq, vm: false };
  }

  function deployment(input: {
    state: string;
    leases?: unknown[];
    hash?: string;
    name?: string | null;
    consoleSettings?: { sdl: string; manifestVersion: string };
  }) {
    return {
      data: {
        data: {
          deployment: { state: input.state, hash: input.hash },
          leases: input.leases ?? [],
          name: input.name ?? null,
          consoleSettings: input.consoleSettings ?? null
        }
      }
    };
  }

  function setup(input: {
    intent: DeploymentIntent;
    canResume?: boolean;
    query?: { isLoading?: boolean; isError?: boolean; error?: unknown; data?: unknown };
    isFollowingFeed?: boolean;
    feed?: { activities?: Activity[]; isError?: boolean };
  }) {
    const replace = vi.fn();
    const enqueueSnackbar = vi.fn();
    let resume: ResumeResolution | undefined;
    const current = { query: input.query, feed: input.feed };

    // react-query's result is a discriminated union on isError/isSuccess that a plain mock<T> partial can't express,
    // so the hand-built result is cast rather than fighting the union.
    const useGetDeployment = vi.fn(
      (_dseq: string | undefined, _options: { isAwaitingCreate: boolean }) =>
        ({
          data: current.query?.data,
          isLoading: current.query?.isLoading ?? false,
          isError: current.query?.error !== undefined,
          error: current.query?.error
        }) as unknown as ReturnType<typeof DEPENDENCIES.useGetDeployment>
    );
    const useFlag = vi.fn((_flag: string) => input.isFollowingFeed ?? false);
    const useLatestActivitiesQuery = vi.fn((_options: { enabled: boolean }) =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLatestActivitiesQuery>>(), {
        data: current.feed?.activities,
        isError: current.feed?.isError ?? false
      })
    );

    const dependencies: typeof DEPENDENCIES = {
      Layout: vi.fn(({ children }: { children: ReactNode }) => <div data-testid="layout-mock">{children}</div>) as never,
      useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace })) as never,
      useSnackbar: (() => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })) as never,
      Snackbar: vi.fn(() => null) as never,
      useGetDeployment: useGetDeployment as never,
      useFlag,
      useLatestActivitiesQuery
    };

    const renderChild = (r: ResumeResolution) => {
      resume = r;
      return <div data-testid="child" />;
    };

    const view = render(
      <ResumeDeploymentGuard intent={input.intent} canResume={input.canResume ?? false} dependencies={dependencies}>
        {renderChild}
      </ResumeDeploymentGuard>
    );

    const rerender = (intent: DeploymentIntent) =>
      view.rerender(
        <ResumeDeploymentGuard intent={intent} canResume={input.canResume ?? false} dependencies={dependencies}>
          {renderChild}
        </ResumeDeploymentGuard>
      );

    return {
      replace,
      enqueueSnackbar,
      useGetDeployment,
      useFlag,
      useLatestActivitiesQuery,
      getResume: () => resume,
      rerender,
      respond: (next: { query?: typeof current.query; feed?: typeof current.feed }) => {
        current.query = next.query ?? current.query;
        current.feed = next.feed ?? current.feed;
        rerender(input.intent);
      }
    };
  }
});
