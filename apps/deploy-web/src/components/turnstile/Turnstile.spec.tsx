import { forwardRef, useEffect } from "react";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { type TurnstileProps } from "@marsidev/react-turnstile";
import { setTimeout as wait } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TurnstileRef } from "./Turnstile";
import { COMPONENTS, Turnstile } from "./Turnstile";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(Turnstile.name, () => {
  it("does not render if turnstile is disabled", async () => {
    await setup({ enabled: false });

    expect(screen.queryByText("Turnstile")).not.toBeInTheDocument();
  });

  it("renders turnstile widget", async () => {
    await setup({ enabled: true });

    expect(screen.queryByText("Turnstile")).toBeInTheDocument();
  });

  it("resets actual widget on error", async () => {
    const turnstileInstance = mock<TurnstileInstance>();
    const ReactTurnstile = forwardRef<TurnstileInstance | undefined, TurnstileProps>((props, ref) => {
      useForwardedRef(ref, turnstileInstance);
      useEffect(() => {
        props.onError?.("test");
      }, []);
      return <div>Turnstile</div>;
    });
    await setup({ enabled: true, components: { ReactTurnstile } });

    expect(turnstileInstance.remove).toHaveBeenCalled();
    expect(turnstileInstance.render).toHaveBeenCalled();
    expect(turnstileInstance.execute).toHaveBeenCalled();
    expect(screen.queryByText("Some error occurred")).toBeInTheDocument();
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

    it("resolves with disabled token when turnstile is disabled", async () => {
      const { turnstileRef } = await setup({ enabled: false });

      const promise = turnstileRef.current!.renderAndWaitResponse();
      await expect(promise).resolves.toEqual({ token: "disabled-turnstile-token" });
    });
  });

  async function setup(input?: { enabled?: boolean; siteKey?: string; onDismissed?: () => void; components?: Partial<typeof COMPONENTS> }) {
    const turnstileRef = { current: null as TurnstileRef | null };

    const result = render(
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
    );
    await act(() => wait(0));

    return { ...result, turnstileRef };
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
