import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";

import { DisposableRegistry } from "./disposable-registry";

describe(DisposableRegistry.name, () => {
  describe("registerFromFactory", () => {
    it("should resolve registry from container and call instance method", () => {
      const registry = setup();
      const instanceMethodSpy = vi.spyOn(registry, "registerFromFactory");
      const factory = vi.fn().mockReturnValue({});

      DisposableRegistry.registerFromFactory(factory);

      expect(container.resolve).toHaveBeenCalledWith(DisposableRegistry);
      expect(instanceMethodSpy).toHaveBeenCalledWith(factory);
    });
  });

  describe("prototype.registerFromFactory", () => {
    it("should return wrapped factory that calls original factory and returns its value", () => {
      const registry = setup();
      const disposable = { dispose: vi.fn() };
      const factory = vi.fn().mockReturnValue(disposable);

      const wrappedFactory = registry.registerFromFactory(factory);
      const result = wrappedFactory(container);

      expect(factory).toHaveBeenCalledWith(container);
      expect(result).toBe(disposable);
    });

    it("should return wrapped factory that handles null values", () => {
      const registry = setup();
      const factory = vi.fn().mockReturnValue(null);

      const wrappedFactory = registry.registerFromFactory(factory);
      const result = wrappedFactory(container);

      expect(factory).toHaveBeenCalledWith(container);
      expect(result).toBeNull();
    });

    it("should return wrapped factory that handles undefined values", () => {
      const registry = setup();
      const factory = vi.fn().mockReturnValue(undefined);

      const wrappedFactory = registry.registerFromFactory(factory);
      const result = wrappedFactory(container);

      expect(factory).toHaveBeenCalledWith(container);
      expect(result).toBeUndefined();
    });

    it("should return wrapped factory that handles primitive values", () => {
      const registry = setup();
      const factory = vi.fn().mockReturnValue("string");

      const wrappedFactory = registry.registerFromFactory(factory);
      const result = wrappedFactory(container);

      expect(factory).toHaveBeenCalledWith(container);
      expect(result).toBe("string");
    });

    it("should return wrapped factory that handles values with dispose property that is not a function", () => {
      const registry = setup();
      const valueWithDispose = { dispose: "not a function" };
      const factory = vi.fn().mockReturnValue(valueWithDispose);

      const wrappedFactory = registry.registerFromFactory(factory);
      const result = wrappedFactory(container);

      expect(factory).toHaveBeenCalledWith(container);
      expect(result).toBe(valueWithDispose);
    });
  });

  describe("prototype.dispose", () => {
    it("should handle empty registry", async () => {
      const registry = setup();
      await expect(registry.dispose()).resolves.toBeUndefined();
    });

    it("should dispose registered disposable values", async () => {
      const registry = setup();
      const dispose = vi.fn().mockResolvedValue(undefined);
      const disposable = { dispose };
      const factory = vi.fn().mockReturnValue(disposable);

      registry.registerFromFactory(factory)(container);

      await registry.dispose();

      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it("should dispose multiple disposables", async () => {
      const registry = setup();
      const dispose1 = vi.fn().mockResolvedValue(undefined);
      const dispose2 = vi.fn();
      const dispose3 = vi.fn().mockResolvedValue(undefined);

      const disposable1 = { dispose: dispose1 };
      const disposable2 = { dispose: dispose2 };
      const disposable3 = { dispose: dispose3 };

      const factory1 = vi.fn().mockReturnValue(disposable1);
      const factory2 = vi.fn().mockReturnValue(disposable2);
      const factory3 = vi.fn().mockReturnValue(disposable3);

      registry.registerFromFactory(factory1)(container);
      registry.registerFromFactory(factory2)(container);
      registry.registerFromFactory(factory3)(container);

      await registry.dispose();

      expect(dispose1).toHaveBeenCalledTimes(1);
      expect(dispose2).toHaveBeenCalledTimes(1);
      expect(dispose3).toHaveBeenCalledTimes(1);
    });

    it("should dispose all registered disposables even if multiple throw", async () => {
      const registry = setup();
      const error1 = new Error("Error 1");
      const error3 = new Error("Error 3");
      const dispose1 = vi.fn().mockRejectedValue(error1);
      const dispose2 = vi.fn().mockResolvedValue(undefined);
      const dispose3 = vi.fn().mockRejectedValue(error3);

      const disposable1 = { dispose: dispose1 };
      const disposable2 = { dispose: dispose2 };
      const disposable3 = { dispose: dispose3 };

      const factory1 = vi.fn().mockReturnValue(disposable1);
      const factory2 = vi.fn().mockReturnValue(disposable2);
      const factory3 = vi.fn().mockReturnValue(disposable3);

      registry.registerFromFactory(factory1)(container);
      registry.registerFromFactory(factory2)(container);
      registry.registerFromFactory(factory3)(container);

      await expect(registry.dispose()).rejects.toThrow(AggregateError);

      expect(dispose1).toHaveBeenCalledTimes(1);
      expect(dispose2).toHaveBeenCalledTimes(1);
      expect(dispose3).toHaveBeenCalledTimes(1);
    });

    it("should be idempotent and not dispose twice when called multiple times", async () => {
      const registry = setup();
      const dispose1 = vi.fn().mockResolvedValue(undefined);
      const dispose2 = vi.fn().mockResolvedValue(undefined);

      const disposable1 = { dispose: dispose1 };
      const disposable2 = { dispose: dispose2 };

      const factory1 = vi.fn().mockReturnValue(disposable1);
      const factory2 = vi.fn().mockReturnValue(disposable2);

      registry.registerFromFactory(factory1)(container);
      registry.registerFromFactory(factory2)(container);

      await registry.dispose();
      await registry.dispose();

      expect(dispose1).toHaveBeenCalledTimes(1);
      expect(dispose2).toHaveBeenCalledTimes(1);
    });
  });

  function setup() {
    const registry = new DisposableRegistry();
    vi.spyOn(container, "resolve").mockReturnValue(registry);
    return registry;
  }
});
