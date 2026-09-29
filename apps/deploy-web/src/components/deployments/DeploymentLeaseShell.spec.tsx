import { forwardRef, useImperativeHandle } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { XTermRefType } from "@src/lib/XTerm/XTerm";
import type { ReceivedShellMessage } from "@src/services/provider-proxy/provider-proxy.service";
import type { LeaseDto } from "@src/types/deployment";
import type { DEPENDENCIES } from "./DeploymentLeaseShell";
import { DeploymentLeaseShell } from "./DeploymentLeaseShell";

import { act, fireEvent, render, screen } from "@testing-library/react";

describe(DeploymentLeaseShell.name, () => {
  it("looks up the provider of the selected lease", async () => {
    const { useProvidersByAddresses } = await setup();

    expect(useProvidersByAddresses).toHaveBeenCalledWith(["akash1provider"]);
  });

  it("hides the lease selector when there is a single lease", async () => {
    const { LeaseSelect } = await setup();

    expect(LeaseSelect).not.toHaveBeenCalled();
  });

  it("shows the lease selector when there are multiple leases", async () => {
    const { LeaseSelect } = await setup({ leaseCount: 2 });

    expect(LeaseSelect).toHaveBeenCalled();
  });

  it("disables copy output until the shell connection is established", async () => {
    await setup();

    expect(screen.getByRole("button", { name: /copy output/i })).toBeDisabled();
  });

  it("copies the terminal output to the clipboard and notifies the user", async () => {
    const { connections, terminal, copyTextToClipboard, notificator } = await setup({ terminalOutput: "$ ls\nfile.txt" });

    await act(() => connections[0].push(textMessage("hello")));
    fireEvent.click(screen.getByRole("button", { name: /copy output/i }));

    expect(terminal.getOutput).toHaveBeenCalled();
    expect(copyTextToClipboard).toHaveBeenCalledWith("$ ls\nfile.txt");
    expect(notificator.success).toHaveBeenCalledWith("Shell output copied to clipboard");
  });

  it("reconnects the shell and clears the terminal when reset is clicked", async () => {
    const { connections, terminal, connectToShell } = await setup();

    await act(() => connections[0].push(textMessage("hello")));
    terminal.reset.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /reset shell/i }));
    await act(() => Promise.resolve());

    expect(terminal.reset).toHaveBeenCalled();
    expect(connectToShell).toHaveBeenCalledTimes(2);
    expect(connectToShell.mock.calls[0][0].signal?.aborted).toBe(true);
    expect(connectToShell.mock.calls[1][0].signal?.aborted).toBe(false);
    expect(screen.getByRole("button", { name: /copy output/i })).toBeDisabled();
  });

  it("greets the user again once the reset shell reconnects", async () => {
    const { connections, terminal } = await setup();

    await act(() => connections[0].push(textMessage("hello")));
    fireEvent.click(screen.getByRole("button", { name: /reset shell/i }));
    await act(() => Promise.resolve());
    terminal.write.mockClear();
    await act(() => connections[1].push(textMessage("prompt")));

    expect(terminal.write).toHaveBeenCalledWith("Welcome to Akash Console Shell! ☁️");
    expect(terminal.write).toHaveBeenCalledWith("prompt");
    expect(screen.getByRole("button", { name: /copy output/i })).toBeEnabled();
  });

  it("opens a new session on every reset", async () => {
    const { connectToShell } = await setup();

    fireEvent.click(screen.getByRole("button", { name: /reset shell/i }));
    await act(() => Promise.resolve());
    fireEvent.click(screen.getByRole("button", { name: /reset shell/i }));
    await act(() => Promise.resolve());

    expect(connectToShell).toHaveBeenCalledTimes(3);
  });

  it("offers a reset from the closed connection state and reconnects", async () => {
    const { connections, connectToShell } = await setup();

    await act(() => connections[0].push({ closed: true }));

    expect(screen.queryByText("Shell access unavailable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reset shell/i }));
    await act(() => Promise.resolve());

    expect(screen.queryByText("Shell access unavailable")).not.toBeInTheDocument();
    expect(connectToShell).toHaveBeenCalledTimes(2);
  });

  function textMessage(text: string): ReceivedShellMessage {
    return { message: { data: [1, ...new TextEncoder().encode(text)] } };
  }

  function createShellConnection() {
    const pendingMessages: ReceivedShellMessage[] = [];
    let wakeReceiver: (() => void) | undefined;

    async function* receive() {
      while (true) {
        const nextMessage = pendingMessages.shift();
        if (nextMessage) {
          yield nextMessage;
        } else {
          await new Promise<void>(resolve => (wakeReceiver = resolve));
        }
      }
    }

    return {
      send: vi.fn(),
      receive,
      push: async (message: ReceivedShellMessage) => {
        pendingMessages.push(message);
        wakeReceiver?.();
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    };
  }

  async function setup(input?: { terminalOutput?: string; leaseCount?: number }) {
    const leases = Array.from({ length: input?.leaseCount ?? 1 }, (_, index) =>
      mock<LeaseDto>({ id: `lease-${index + 1}`, provider: "akash1provider", dseq: "123", gseq: 1, oseq: index + 1 })
    );
    const connections: ReturnType<typeof createShellConnection>[] = [];
    const connectToShell = vi.fn((_: { signal?: AbortSignal }) => {
      const connection = createShellConnection();
      connections.push(connection);
      return connection;
    });
    const services = mock<ReturnType<typeof DEPENDENCIES.useServices>>({
      providerProxy: mock<ReturnType<typeof DEPENDENCIES.useServices>["providerProxy"]>({
        connectToShell: connectToShell as unknown as ReturnType<typeof DEPENDENCIES.useServices>["providerProxy"]["connectToShell"]
      })
    });
    const notificator = mock<ReturnType<typeof DEPENDENCIES.useNotificator>>();
    const providerCredentials = mock<ReturnType<typeof DEPENDENCIES.useProviderCredentials>>({
      details: { type: "jwt", value: "token", isExpired: false, usable: true, error: null }
    });
    const providers = mock<ReturnType<typeof DEPENDENCIES.useProvidersByAddresses>>({
      data: [{ owner: "akash1provider", hostUri: "https://provider.example.com" }] as ReturnType<typeof DEPENDENCIES.useProvidersByAddresses>["data"]
    });
    const leaseStatus = mock<ReturnType<typeof DEPENDENCIES.useLeaseStatus>>({
      data: { services: { web: {} } } as unknown as ReturnType<typeof DEPENDENCIES.useLeaseStatus>["data"],
      refetch: vi.fn(),
      isFetching: false
    });
    const terminal = {
      write: vi.fn(),
      loadAddon: vi.fn(),
      clear: vi.fn(),
      reset: vi.fn(),
      focus: vi.fn(),
      getOutput: vi.fn(() => input?.terminalOutput ?? "")
    } satisfies XTermRefType;
    const XTerm = forwardRef<XTermRefType>(function XTermStub(_, ref) {
      useImperativeHandle(ref, () => terminal);
      return <div>terminal</div>;
    });
    const copyTextToClipboard = vi.fn();
    const useProvidersByAddresses = vi.fn(() => providers);
    const LeaseSelect = vi.fn(() => null);

    const dependencies = {
      useServices: () => services,
      useNotificator: () => notificator,
      useProviderAccess: () => true,
      useProviderCredentials: () => providerCredentials,
      useLeaseStatus: () => leaseStatus,
      useProvidersByAddresses,
      copyTextToClipboard,
      XTerm,
      LeaseSelect,
      ServiceSelect: vi.fn(() => null),
      ShellDownloadModal: vi.fn(() => null),
      ProviderAuthFallback: vi.fn(() => null)
    } as unknown as typeof DEPENDENCIES;

    render(<DeploymentLeaseShell leases={leases} dependencies={dependencies} />);
    await act(() => Promise.resolve());

    return { connections, connectToShell, terminal, copyTextToClipboard, notificator, useProvidersByAddresses, LeaseSelect };
  }
});
