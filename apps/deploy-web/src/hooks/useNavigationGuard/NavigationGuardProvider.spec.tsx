import { render, screen } from "@testing-library/react";
import { NavigationGuardProvider } from "next-navigation-guard";

describe("NavigationGuardProvider compatibility", () => {
  // Store original crypto object
  const originalCrypto = global.crypto;

  beforeEach(() => {
    // Reset history state before each test
    if (typeof window !== "undefined" && window.history) {
      window.history.replaceState({}, "", "/");
    }
  });

  afterEach(() => {
    // Restore original crypto
    global.crypto = originalCrypto;
  });

  it("should work without crypto.randomUUID (Android 10 compatibility)", () => {
    // Simulate older browser without crypto.randomUUID (like Android 10)
    // Create a minimal crypto object without randomUUID but with other standard methods
    const oldBrowserCrypto = {
      getRandomValues: (arr: any) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
      subtle: {} as SubtleCrypto,
      randomUUID: undefined
    } as any;
    
    global.crypto = oldBrowserCrypto;

    let error: Error | null = null;
    try {
      render(
        <NavigationGuardProvider>
          <div data-testid="old-browser-test">Old Browser Compatible</div>
        </NavigationGuardProvider>
      );
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeNull();
    expect(screen.getByTestId("old-browser-test")).toBeInTheDocument();
  });

  it("should render children successfully", () => {
    render(
      <NavigationGuardProvider>
        <div data-testid="child-content">Navigation Guard Works</div>
      </NavigationGuardProvider>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Navigation Guard Works")).toBeInTheDocument();
  });

  it("should work without crypto object (very old browsers)", () => {
    // Simulate very old browser without crypto at all
    delete (global as any).crypto;

    expect(() => {
      render(
        <NavigationGuardProvider>
          <div>Test Content Without Crypto</div>
        </NavigationGuardProvider>
      );
    }).not.toThrow();

    expect(screen.getByText("Test Content Without Crypto")).toBeInTheDocument();
  });

  it("should handle multiple provider instances", () => {
    render(
      <>
        <NavigationGuardProvider>
          <div data-testid="provider-1">Provider 1</div>
        </NavigationGuardProvider>
        <NavigationGuardProvider>
          <div data-testid="provider-2">Provider 2</div>
        </NavigationGuardProvider>
      </>
    );

    expect(screen.getByTestId("provider-1")).toBeInTheDocument();
    expect(screen.getByTestId("provider-2")).toBeInTheDocument();
  });
});
