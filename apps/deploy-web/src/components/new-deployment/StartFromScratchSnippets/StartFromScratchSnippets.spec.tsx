import { describe, expect, it, vi } from "vitest";

import { ContainerSdlSnippet, SshSessionSnippet, WELCOME_BANNER_ROTATION_MS } from "./StartFromScratchSnippets";

import { act, render, screen } from "@testing-library/react";

describe("StartFromScratchSnippets", () => {
  it("shows a deploy.yaml running an example image", () => {
    const { container } = render(<ContainerSdlSnippet />);

    expect(container).toHaveTextContent("services: web: image: ghcr.io/you/app:latest expose: 8080 → 80");
  });

  it("shows an ssh session into the machine", () => {
    const { container } = setupSshSession();

    expect(container).toHaveTextContent("$ ssh root@your-machine -p 32022");
    expect(container).toHaveTextContent("root@akash:~#");
  });

  it("rotates the ssh welcome banner through every distro and wraps around", () => {
    setupSshSession();
    const banners: Array<string | null> = [];

    for (let tick = 0; tick < 5; tick++) {
      banners.push(screen.getByText(/Ubuntu|CentOS|Debian|openSUSE/).textContent);
      act(() => vi.advanceTimersByTime(WELCOME_BANNER_ROTATION_MS));
    }

    expect(banners).toEqual([
      "Welcome to Ubuntu 24.04 LTS",
      "CentOS Stream release 9",
      "Debian GNU/Linux 11 (bullseye)",
      "openSUSE Leap 15.5",
      "Welcome to Ubuntu 24.04 LTS"
    ]);
  });

  it("stops rotating the ssh welcome banner once unmounted", () => {
    const { unmount } = setupSshSession();

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  function setupSshSession() {
    vi.useFakeTimers();
    return render(<SshSessionSnippet />);
  }
});
