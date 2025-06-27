import { useEffect } from "react";
import type { usePopup } from "@akashnetwork/ui/context";
import type { useNavigationGuard as useNavigationGuardOriginal } from "next-navigation-guard";

import type { UseNavigationGuardOptions } from "./useNavigationGuard";
import { useNavigationGuard } from "./useNavigationGuard";

import { act, renderHook, waitFor } from "@testing-library/react";

describe(useNavigationGuard.name, () => {
  it("should be enabled via props", async () => {
    const { confirm } = setup({ enabled: true });

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledWith("You have unsaved changes. Are you sure you want to leave?");
    });
  });

  it("should use custom message when provided", async () => {
    const { confirm } = setup({ enabled: true, message: "Custom warning message" });

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledWith("Custom warning message");
    });
  });

  it("should not call confirm when disabled", async () => {
    const { confirm } = setup({ enabled: false });

    await waitFor(() => {
      expect(confirm).not.toHaveBeenCalled();
    });
  });

  it("should skip confirmation when skipWhen returns true", async () => {
    const skipWhen = jest.fn(() => true);
    const { confirm } = setup({ enabled: true, skipWhen });

    await waitFor(() => {
      expect(skipWhen).toHaveBeenCalledWith({ to: "", type: "push" });
      expect(confirm).not.toHaveBeenCalled();
    });
  });

  it("should call confirm when skipWhen returns false", async () => {
    const skipWhen = jest.fn(() => false);
    const { confirm } = setup({ enabled: true, skipWhen });

    await waitFor(() => {
      expect(skipWhen).toHaveBeenCalledWith({ to: "", type: "push" });
      expect(confirm).toHaveBeenCalledWith("You have unsaved changes. Are you sure you want to leave?");
    });
  });

  it("should toggle enabled state when called with boolean", async () => {
    const { toggle, confirm } = setup({});

    expect(confirm).not.toHaveBeenCalled();

    act(() => {
      toggle(true);
    });

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledWith("You have unsaved changes. Are you sure you want to leave?");
    });
  });

  it("should toggle enabled state when called with hasChanges object", async () => {
    const { toggle, confirm } = setup({});

    expect(confirm).not.toHaveBeenCalled();

    act(() => {
      toggle({ hasChanges: true });
    });

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledWith("You have unsaved changes. Are you sure you want to leave?");
    });
  });

  it("should handle empty options object", async () => {
    const { confirm } = setup({});

    await waitFor(() => {
      expect(confirm).not.toHaveBeenCalled();
    });
  });

  it("should handle undefined options", async () => {
    const { confirm } = setup(undefined as any);

    await waitFor(() => {
      expect(confirm).not.toHaveBeenCalled();
    });
  });

  it("should respect explicit false enabled prop", async () => {
    const { toggle, confirm } = setup({ enabled: false });

    await waitFor(() => {
      expect(confirm).not.toHaveBeenCalled();
    });

    act(() => {
      toggle(true);
    });

    await waitFor(() => {
      expect(confirm).not.toHaveBeenCalled();
    });
  });

  it("should use toggle state when enabled is undefined", async () => {
    const { toggle, confirm } = setup({});

    await waitFor(() => {
      expect(confirm).not.toHaveBeenCalled();
    });

    act(() => {
      toggle(true);
    });

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledWith("You have unsaved changes. Are you sure you want to leave?");
    });
  });

  it("should handle toggle with false hasChanges", async () => {
    const { toggle, confirm } = setup({});

    act(() => {
      toggle({ hasChanges: false });
    });

    await waitFor(() => {
      expect(confirm).not.toHaveBeenCalled();
    });
  });

  it("should prevent toggle when enabled prop is provided", async () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
    const { toggle, confirm } = setup({ enabled: false });

    await waitFor(() => {
      expect(confirm).not.toHaveBeenCalled();
    });

    act(() => {
      toggle(true);
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("can't toggle enabled state when enabled prop is provided");
    });

    expect(confirm).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  function setup(props: UseNavigationGuardOptions) {
    const confirm = jest.fn();

    const useNavigationGuardOriginalMock: typeof useNavigationGuardOriginal = options => {
      useEffect(() => {
        if (options.enabled) {
          options?.confirm?.({ to: "", type: "push" });
        }
      }, [options.enabled]);

      return {
        active: true,
        accept: jest.fn(),
        reject: jest.fn()
      };
    };

    const usePopupMock = () => ({
      confirm
    });

    const DEPENDENCIES = {
      useNavigationGuard: useNavigationGuardOriginalMock,
      usePopup: usePopupMock as unknown as typeof usePopup
    };

    const res = renderHook(() => useNavigationGuard({ ...props, dependencies: DEPENDENCIES }));

    return {
      toggle: res.result.current.toggle,
      confirm
    };
  }
});
