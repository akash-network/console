import { useWhen } from "../useWhen";

import { renderHook } from "@testing-library/react";

describe("useWhen Hook", () => {
  it("should call the callback when condition is true", () => {
    const callback = jest.fn();
    renderHook(() => useWhen(true, callback));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should not call the callback when condition is false", () => {
    const callback = jest.fn();
    renderHook(() => useWhen(false, callback));

    expect(callback).not.toHaveBeenCalled();
  });

  it("should re-run the callback when deps change", () => {
    const callback = jest.fn();
    const { rerender } = renderHook(({ condition, dependencies }) => useWhen(condition, callback, dependencies), {
      initialProps: { condition: true, dependencies: [1] }
    });

    expect(callback).toHaveBeenCalledTimes(1);

    // Rerender with changed dep
    rerender({ condition: true, dependencies: [2] });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("should not re-run the callback when deps do not change", () => {
    const callback = jest.fn();
    const { rerender } = renderHook(({ condition, dependencies }) => useWhen(condition, callback, dependencies), {
      initialProps: { condition: true, dependencies: [1] }
    });

    expect(callback).toHaveBeenCalledTimes(1);

    // Rerender with same dep
    rerender({ condition: true, dependencies: [1] });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should run the callback when condition changes from false to true", () => {
    const callback = jest.fn();
    const { rerender } = renderHook(({ condition }) => useWhen(condition, callback), {
      initialProps: { condition: false }
    });

    expect(callback).not.toHaveBeenCalled();

    // Change condition to true
    rerender({ condition: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
