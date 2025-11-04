import { container } from "tsyringe";

import { DisposableRegistry } from "./disposable-registry";

describe(DisposableRegistry.name, () => {
  describe("registerFromFactory", () => {
    it("should resolve registry from container and call instance method", () => {
      const registry = setup();
      const instanceMethodSpy = jest.spyOn(registry, "registerFromFactory");
      const factory = jest.fn().mockReturnValue({});

      DisposableRegistry.registerFromFactory(factory);

      expect(container.resolve).toHaveBeenCalledWith(DisposableRegistry);
      expect(instanceMethodSpy).toHaveBeenCalledWith(factory);
    });
  });

  describe("prototype.registerFromFactory", () => {
    it("should return wrapped factory that calls original factory and returns its value", () => {
      const registry = setup();
      const disposable = { dispose: jest.fn() };
      const factory = jest.fn().mockReturnValue(disposable);

      const wrappedFactory = registry.registerFromFactory(factory);
      const result = wrappedFactory(container);

      expect(factory).toHaveBeenCalledWith(container);
      expect(result).toBe(disposable);
    });

    it("should return wrapped factory that handles null values", () => {
      const registry = setup();
      const factory = jest.fn().mockReturnValue(null);

      const wrappedFactory = registry.registerFromFactory(factory);
      const result = wrappedFactory(container);

      expect(factory).toHaveBeenCalledWith(container);
      expect(result).toBeNull();
    });

    it("should return wrapped factory that handles undefined values", () => {
      const registry = setup();
      const factory = jest.fn().mockReturnValue(undefined);

      const wrappedFactory = registry.registerFromFactory(factory);
      const result = wrappedFactory(container);

      expect(factory).toHaveBeenCalledWith(container);
      expect(result).toBeUndefined();
    });

    it("should return wrapped factory that handles primitive values", () => {
      const registry = setup();
      const factory = jest.fn().mockReturnValue("string");

      const wrappedFactory = registry.registerFromFactory(factory);
      const result = wrappedFactory(container);

      expect(factory).toHaveBeenCalledWith(container);
      expect(result).toBe("string");
    });

    it("should return wrapped factory that handles values with dispose property that is not a function", () => {
      const registry = setup();
      const valueWithDispose = { dispose: "not a function" };
      const factory = jest.fn().mockReturnValue(valueWithDispose);

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
      const dispose = jest.fn().mockResolvedValue(undefined);
      const disposable = { dispose };
      const factory = jest.fn().mockReturnValue(disposable);

      registry.registerFromFactory(factory)(container);

      await registry.dispose();

      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it("should dispose multiple disposables", async () => {
      const registry = setup();
      const dispose1 = jest.fn().mockResolvedValue(undefined);
      const dispose2 = jest.fn();
      const dispose3 = jest.fn().mockResolvedValue(undefined);

      const disposable1 = { dispose: dispose1 };
      const disposable2 = { dispose: dispose2 };
      const disposable3 = { dispose: dispose3 };

      const factory1 = jest.fn().mockReturnValue(disposable1);
      const factory2 = jest.fn().mockReturnValue(disposable2);
      const factory3 = jest.fn().mockReturnValue(disposable3);

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
      const dispose1 = jest.fn().mockRejectedValue(error1);
      const dispose2 = jest.fn().mockResolvedValue(undefined);
      const dispose3 = jest.fn().mockRejectedValue(error3);

      const disposable1 = { dispose: dispose1 };
      const disposable2 = { dispose: dispose2 };
      const disposable3 = { dispose: dispose3 };

      const factory1 = jest.fn().mockReturnValue(disposable1);
      const factory2 = jest.fn().mockReturnValue(disposable2);
      const factory3 = jest.fn().mockReturnValue(disposable3);

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
      const dispose1 = jest.fn().mockResolvedValue(undefined);
      const dispose2 = jest.fn().mockResolvedValue(undefined);

      const disposable1 = { dispose: dispose1 };
      const disposable2 = { dispose: dispose2 };

      const factory1 = jest.fn().mockReturnValue(disposable1);
      const factory2 = jest.fn().mockReturnValue(disposable2);

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
    jest.spyOn(container, "resolve").mockReturnValue(registry);
    return registry;
  }
});
