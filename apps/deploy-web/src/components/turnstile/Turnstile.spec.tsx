import { forwardRef, useEffect } from "react";
import { act } from "react-dom/test-utils";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { type TurnstileProps } from "@marsidev/react-turnstile";
import { mock } from "jest-mock-extended";
import { setTimeout as wait } from "node:timers/promises";

import { COMPONENTS, Turnstile } from "./Turnstile";

import { fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(Turnstile.name, () => {
  it("does not render if turnstile is disabled", async () => {
    await setup({ enabled: false });

    expect(screen.queryByText("Turnstile")).not.toBeInTheDocument();
  });

  it("does not patch fetch API if turnstile is disabled", async () => {
    const originalFetch = window.fetch;
    await setup({ enabled: false });

    expect(window.fetch).toBe(originalFetch);
  });

  it("patches fetch API if turnstile is enabled", async () => {
    const originalFetch = window.fetch;
    await setup({ enabled: true });

    expect(window.fetch).not.toBe(originalFetch);
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
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(turnstileInstance.remove).toHaveBeenCalled();
    expect(turnstileInstance.render).toHaveBeenCalled();
    expect(turnstileInstance.execute).toHaveBeenCalled();
  });

  it('removes actual widget on "Dismiss" button click', async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(turnstileInstance.remove).toHaveBeenCalled();
    expect(turnstileInstance.render).not.toHaveBeenCalled();
    expect(turnstileInstance.execute).not.toHaveBeenCalled();
  });

  describe("when CF-Mitigated header is present", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      let amountOfCalls = 0;
      globalThis.fetch = jest.fn(async () => {
        if (amountOfCalls > 0) {
          return new Response("done", {
            status: 200
          });
        }

        const response = new Response("", {
          status: 403,
          headers: new Headers({ "cf-mitigated": "challenge" })
        });

        amountOfCalls++;

        return response;
      });
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("renders turnstile widget", async () => {
      const turnstileInstance = mock<TurnstileInstance>();
      const ReactTurnstile = forwardRef<TurnstileInstance | undefined, TurnstileProps>((props, ref) => {
        useForwardedRef(ref, turnstileInstance);
        return <div>Turnstile</div>;
      });

      await setup({ enabled: true, components: { ReactTurnstile } });
      await fetch("/");

      expect(turnstileInstance.render).toHaveBeenCalled();
    });

    it('does not retry request if "Dismiss" button is clicked', async () => {
      const fetchMock = globalThis.fetch;

      await setup({
        enabled: true,
        components: {
          Button: forwardRef((props, ref) => (
            <button type="button" {...props} ref={ref} onClick={props.onClick}>
              {props.children}
            </button>
          ))
        }
      });
      await fetch("/");
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("retries request if challenge is solved", async () => {
      const fetchMock = globalThis.fetch;
      const turnstileInstance = mock<TurnstileInstance>({
        getResponsePromise: () => Promise.resolve("test response")
      });
      const ReactTurnstile = forwardRef<TurnstileInstance | undefined, TurnstileProps>((props, ref) => {
        useForwardedRef(ref, turnstileInstance);
        return <div>Turnstile</div>;
      });

      await setup({ enabled: true, components: { ReactTurnstile } });
      await fetch("/");

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  async function setup(input?: { enabled?: boolean; siteKey?: string; components?: Partial<typeof COMPONENTS> }) {
    const result = render(
      <Turnstile
        enabled={!!input?.enabled}
        siteKey="unittest-site-key"
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

    return result;
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
