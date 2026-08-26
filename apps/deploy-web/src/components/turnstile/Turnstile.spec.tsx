import { forwardRef, useEffect } from "react";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { type TurnstileProps } from "@marsidev/react-turnstile";
import { setTimeout as wait } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import type { TurnstileRef } from "./Turnstile";
import { CHALLENGE_DEADLINE_MS, COMPONENTS, Turnstile } from "./Turnstile";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(Turnstile.name, () => {
  it("does not render if turnstile is disabled", async () => {
    await setup({ enabled: false });

    expect(screen.queryByText("Turnstile")).not.toBeInTheDocument();
  });

  it("renders turnstile widget", async () => {
    await setup({ enabled: true });

    expect(screen.queryByText("Turnstile")).toBeInTheDocument();
  });

  it("leaves the widget in place on error so Cloudflare's own retry can recover", async () => {
    const { ReactTurnstile, instance, latestProps } = createTurnstileMock();
    await setup({ enabled: true, components: { ReactTurnstile } });

    await act(async () => {
      latestProps.current?.onError?.("network-error");
      await wait(0);
    });

    expect(instance.remove).not.toHaveBeenCalled();
    expect(instance.render).not.toHaveBeenCalled();
    expect(instance.execute).not.toHaveBeenCalled();
    expect(screen.queryByText("Some error occurred")).toBeInTheDocument();
  });

  it("reports challenge failures so they are visible in production", async () => {
    const { ReactTurnstile, latestProps } = createTurnstileMock();
    const { errorHandler } = await setup({ enabled: true, components: { ReactTurnstile } });

    await act(async () => {
      latestProps.current?.onError?.("network-error");
      await wait(0);
    });

    expect(errorHandler.reportError).toHaveBeenCalledWith(expect.objectContaining({ error: "network-error", tags: { event: "TURNSTILE_CHALLENGE_FAILED" } }));
  });

  it("reports only the first failure of a run so Cloudflare's retries cannot storm Sentry", async () => {
    const { ReactTurnstile, latestProps } = createTurnstileMock();
    const { errorHandler } = await setup({ enabled: true, components: { ReactTurnstile } });

    for (let attempt = 0; attempt < 3; attempt++) {
      await act(async () => {
        latestProps.current?.onError?.("network-error");
        await wait(0);
      });
    }

    expect(errorHandler.reportError).toHaveBeenCalledTimes(1);
  });

  it("reports the first failure of every run, not only of the first one", async () => {
    const { ReactTurnstile, latestProps } = createTurnstileMock();
    const { turnstileRef, errorHandler } = await setup({ enabled: true, components: { ReactTurnstile } });

    for (let run = 0; run < 2; run++) {
      turnstileRef.current!.renderAndWaitResponse().catch(() => undefined);
      await act(async () => {
        latestProps.current?.onError?.("network-error");
        await wait(0);
      });
    }

    expect(errorHandler.reportError).toHaveBeenCalledTimes(2);
  });

  it("never restarts the widget when errors alternate with interactive prompts", async () => {
    const { ReactTurnstile, instance, latestProps } = createTurnstileMock();
    await setup({ enabled: true, components: { ReactTurnstile } });

    for (let attempt = 0; attempt < 3; attempt++) {
      await act(async () => {
        latestProps.current?.onError?.("network-error");
        await wait(0);
      });
      await act(async () => {
        latestProps.current?.onBeforeInteractive?.();
        await wait(0);
      });
    }

    expect(instance.remove).not.toHaveBeenCalled();
    expect(instance.execute).not.toHaveBeenCalled();
  });

  it('resets actual widget on "Retry" button click', async () => {
    const turnstileInstance = mock<TurnstileInstance>();
    const ReactTurnstile = forwardRef<TurnstileInstance | undefined, TurnstileProps>((props, ref) => {
      useForwardedRef(ref, turnstileInstance);
      return <div>Turnstile</div>;
    });

    await setup({
      enabled: true,
      components: {
        ReactTurnstile,
        Button: forwardRef((props, ref) => (
          <button type="button" {...props} ref={ref} onClick={props.onClick}>
            {props.children}
          </button>
        ))
      }
    });
    fireEvent.click(screen.getAllByRole("button")[0]);

    expect(turnstileInstance.remove).toHaveBeenCalled();
    expect(turnstileInstance.render).toHaveBeenCalled();
    expect(turnstileInstance.execute).toHaveBeenCalled();
  });

  it('removes actual widget on "Go Back" button click', async () => {
    const turnstileInstance = mock<TurnstileInstance>();
    const ReactTurnstile = forwardRef<TurnstileInstance | undefined, TurnstileProps>((props, ref) => {
      useForwardedRef(ref, turnstileInstance);
      return <div>Turnstile</div>;
    });
    const onDismissed = vi.fn();

    await setup({
      enabled: true,
      onDismissed,
      components: {
        ReactTurnstile,
        Button: forwardRef((props, ref) => (
          <button type="button" {...props} ref={ref} onClick={props.onClick}>
            {props.children}
          </button>
        ))
      }
    });
    fireEvent.click(screen.getAllByRole("button")[1]);

    expect(turnstileInstance.remove).toHaveBeenCalled();
    expect(turnstileInstance.render).not.toHaveBeenCalled();
    expect(turnstileInstance.execute).not.toHaveBeenCalled();
    expect(onDismissed).toHaveBeenCalled();
  });

  describe("renderAndWaitResponse", () => {
    it("resolves with token when challenge is solved", async () => {
      const turnstileInstance = mock<TurnstileInstance>();
      let triggerSuccess: ((token: string) => void) | undefined;
      const ReactTurnstile = forwardRef<TurnstileInstance | undefined, TurnstileProps>((props, ref) => {
        useForwardedRef(ref, turnstileInstance);
        triggerSuccess = (token: string) => props.onSuccess?.(token);
        return <div>Turnstile</div>;
      });

      const { turnstileRef } = await setup({
        enabled: true,
        components: { ReactTurnstile }
      });

      const promise = turnstileRef.current!.renderAndWaitResponse();
      await act(async () => {
        triggerSuccess?.("test-token");
        await wait(0);
      });

      await expect(promise).resolves.toEqual({ token: "test-token" });
      expect(turnstileInstance.remove).toHaveBeenCalled();
      expect(turnstileInstance.render).toHaveBeenCalled();
      expect(turnstileInstance.execute).toHaveBeenCalled();
    });

    it("rejects with error when challenge fails", async () => {
      const turnstileInstance = mock<TurnstileInstance>();
      let triggerError: ((error: string) => void) | undefined;
      const ReactTurnstile = forwardRef<TurnstileInstance | undefined, TurnstileProps>((props, ref) => {
        useForwardedRef(ref, turnstileInstance);
        triggerError = (error: string) => props.onError?.(error);
        return <div>Turnstile</div>;
      });

      const { turnstileRef } = await setup({
        enabled: true,
        components: { ReactTurnstile }
      });

      let rejection: unknown;
      const promise = turnstileRef.current!.renderAndWaitResponse().catch(error => {
        rejection = error;
      });
      await act(async () => {
        triggerError?.("test-error");
        await wait(0);
      });
      await promise;

      expect(rejection).toMatchObject({
        reason: "error",
        error: "test-error"
      });
    });

    it("rejects the pending challenge when the widget is dismissed", async () => {
      let rejection: unknown;
      const { turnstileRef } = await setup({ enabled: true, components: { Button: ButtonMock } });

      const promise = turnstileRef.current!.renderAndWaitResponse().catch(error => {
        rejection = error;
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /dismiss captcha/i }));
        await wait(0);
      });
      await promise;

      expect(rejection).toMatchObject({ reason: "dismissed" });
    });

    it("rejects the pending challenge when the caller abandons it", async () => {
      let rejection: unknown;
      const { turnstileRef } = await setup({ enabled: true });

      const promise = turnstileRef.current!.renderAndWaitResponse().catch(error => {
        rejection = error;
      });
      await act(async () => {
        turnstileRef.current!.abandonPendingChallenge();
        await wait(0);
      });
      await promise;

      expect(rejection).toMatchObject({ reason: "dismissed" });
    });

    it("does not resolve a challenge abandoned by the caller when it later succeeds", async () => {
      let triggerSuccess: ((token: string) => void) | undefined;
      const ReactTurnstile = forwardRef<TurnstileInstance | undefined, TurnstileProps>((props, ref) => {
        useForwardedRef(ref);
        triggerSuccess = (token: string) => props.onSuccess?.(token);
        return <div>Turnstile</div>;
      });
      const { turnstileRef } = await setup({ enabled: true, components: { ReactTurnstile } });

      const abandoned = vi.fn();
      turnstileRef.current!.renderAndWaitResponse().then(abandoned, () => undefined);
      await act(async () => {
        turnstileRef.current!.abandonPendingChallenge();
        await wait(0);
      });

      await act(async () => {
        triggerSuccess?.("test-token");
        await wait(0);
      });

      expect(abandoned).not.toHaveBeenCalled();
    });

    it("does not resolve an abandoned challenge when a later one succeeds", async () => {
      let triggerSuccess: ((token: string) => void) | undefined;
      const ReactTurnstile = forwardRef<TurnstileInstance | undefined, TurnstileProps>((props, ref) => {
        useForwardedRef(ref);
        triggerSuccess = (token: string) => props.onSuccess?.(token);
        return <div>Turnstile</div>;
      });
      const { turnstileRef } = await setup({ enabled: true, components: { ReactTurnstile, Button: ButtonMock } });

      const abandoned = vi.fn();
      turnstileRef.current!.renderAndWaitResponse().then(abandoned, () => undefined);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /dismiss captcha/i }));
        await wait(0);
      });

      const retried = turnstileRef.current!.renderAndWaitResponse();
      await act(async () => {
        triggerSuccess?.("test-token");
        await wait(0);
      });

      await expect(retried).resolves.toEqual({ token: "test-token" });
      expect(abandoned).not.toHaveBeenCalled();
    });

    it("resolves once Cloudflare refreshes an expired token", async () => {
      const { ReactTurnstile, latestProps } = createTurnstileMock();
      const { turnstileRef } = await setup({ enabled: true, components: { ReactTurnstile } });

      const promise = turnstileRef.current!.renderAndWaitResponse();
      await act(async () => {
        latestProps.current?.onExpire?.("stale-token");
        await wait(0);
      });
      await act(async () => {
        latestProps.current?.onSuccess?.("refreshed-token");
        await wait(0);
      });

      await expect(promise).resolves.toEqual({ token: "refreshed-token" });
    });

    it("rejects a challenge that never settles instead of hanging the caller", async () => {
      const { turnstileRef, errorHandler } = await setup({ enabled: true });
      vi.useFakeTimers();

      try {
        let rejection: unknown;
        const promise = turnstileRef.current!.renderAndWaitResponse().catch(error => {
          rejection = error;
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(CHALLENGE_DEADLINE_MS);
        });
        await promise;

        expect(rejection).toMatchObject({ reason: "timeout" });
        expect(errorHandler.reportError).toHaveBeenCalledWith(expect.objectContaining({ tags: { event: "TURNSTILE_CHALLENGE_WEDGED" } }));
      } finally {
        vi.useRealTimers();
      }
    });

    it("drops a pending challenge on unmount without reporting it wedged 2 minutes later", async () => {
      const { turnstileRef, errorHandler, unmount } = await setup({ enabled: true });
      vi.useFakeTimers();

      try {
        const settled = vi.fn();
        turnstileRef.current!.renderAndWaitResponse().then(settled, settled);
        await act(async () => {
          unmount();
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(CHALLENGE_DEADLINE_MS);
        });

        expect(errorHandler.reportError).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not reject on unmount, so an abandoned page cannot report a captcha error the visitor never saw", async () => {
      const { turnstileRef, unmount } = await setup({ enabled: true });
      vi.useFakeTimers();

      try {
        const settled = vi.fn();
        turnstileRef.current!.renderAndWaitResponse().then(settled, settled);
        await act(async () => {
          unmount();
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(CHALLENGE_DEADLINE_MS);
        });

        expect(settled).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("resolves with disabled token when turnstile is disabled", async () => {
      const { turnstileRef } = await setup({ enabled: false });

      const promise = turnstileRef.current!.renderAndWaitResponse();
      await expect(promise).resolves.toEqual({ token: "disabled-turnstile-token" });
    });
  });

  async function setup(input?: { enabled?: boolean; siteKey?: string; onDismissed?: () => void; components?: Partial<typeof COMPONENTS> }) {
    const turnstileRef = { current: null as TurnstileRef | null };
    const errorHandler = mock<ErrorHandlerService>();

    const result = render(
      <TestContainerProvider services={{ errorHandler: () => errorHandler }}>
        <Turnstile
          ref={turnstileRef}
          enabled={!!input?.enabled}
          siteKey="unittest-site-key"
          onDismissed={input?.onDismissed}
          components={MockComponents(COMPONENTS, {
            ReactTurnstile: forwardRef<TurnstileInstance | undefined, TurnstileProps>((_, ref) => {
              useForwardedRef(ref);
              return <div>Turnstile</div>;
            }),
            ...input?.components
          })}
        />
      </TestContainerProvider>
    );
    await act(() => wait(0));

    return { ...result, turnstileRef, errorHandler };
  }

  const ButtonMock = forwardRef<HTMLButtonElement, React.ComponentProps<typeof COMPONENTS.Button>>((props, ref) => (
    <button type="button" {...props} ref={ref} onClick={props.onClick}>
      {props.children}
    </button>
  ));

  function createTurnstileMock(instance: TurnstileInstance = mock<TurnstileInstance>()) {
    const latestProps: { current: TurnstileProps | undefined } = { current: undefined };
    const ReactTurnstile = forwardRef<TurnstileInstance | undefined, TurnstileProps>((props, ref) => {
      useForwardedRef(ref, instance);
      latestProps.current = props;
      return <div>Turnstile</div>;
    });

    return { ReactTurnstile, instance, latestProps };
  }

  function useForwardedRef<T>(ref: React.ForwardedRef<T>, instance: T = mock<T>()) {
    useEffect(() => {
      if (typeof ref === "function") {
        ref(instance);
      } else if (ref) {
        ref.current = instance;
      }
    }, []);
  }
});
