import { cacheEngine, cacheResponse, Memoize, memoizeAsync } from "./helpers";

describe("Memoize Function", () => {
  describe("cacheResponse function", () => {
    it("should return cached data immediately when available and valid", async () => {
      setup();

      const mockData = { test: "data" };
      const cachedObject = { date: new Date(), data: mockData };

      cacheEngine.storeInCache("test-key", cachedObject);

      const refreshRequest = jest.fn().mockResolvedValue({ new: "data" });

      const result = await cacheResponse(120, "test-key", refreshRequest);

      expect(result).toEqual(mockData);
      expect(refreshRequest).not.toHaveBeenCalled();
    });

    it("should return expired cached data immediately and start background refresh", async () => {
      setup();

      const mockData = { test: "data" };
      const expiredDate = new Date(Date.now() - 200 * 1000); // 200 seconds ago
      const cachedObject = { date: expiredDate, data: mockData };

      cacheEngine.storeInCache("test-key", cachedObject);

      const refreshRequest = jest.fn().mockResolvedValue({ new: "data" });

      const result = await cacheResponse(120, "test-key", refreshRequest);

      expect(result).toEqual(mockData);
      expect(refreshRequest).toHaveBeenCalledTimes(1);

      // Wait for background refresh to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify new data was cached
      const updatedCache = cacheEngine.getFromCache("test-key");
      expect(updatedCache).toEqual({ date: expect.any(Date), data: { new: "data" } });
    });

    it("should not start multiple background refreshes for the same key", async () => {
      setup();

      const mockData = { test: "data" };
      const expiredDate = new Date(Date.now() - 200 * 1000);
      const cachedObject = { date: expiredDate, data: mockData };

      cacheEngine.storeInCache("test-key", cachedObject);

      const refreshRequest = jest.fn().mockResolvedValue({ new: "data" });

      // Make multiple concurrent calls
      const promises = [
        cacheResponse(120, "test-key", refreshRequest),
        cacheResponse(120, "test-key", refreshRequest),
        cacheResponse(120, "test-key", refreshRequest)
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([mockData, mockData, mockData]);
      expect(refreshRequest).toHaveBeenCalledTimes(1); // Only one background refresh
    });

    it("should make new request and wait for it when no cached data exists", async () => {
      setup();

      const newData = { fresh: "data" };
      const refreshRequest = jest.fn().mockResolvedValue(newData);

      const result = await cacheResponse(120, "test-key", refreshRequest);

      expect(result).toEqual(newData);
      expect(refreshRequest).toHaveBeenCalledTimes(1);

      // Verify data was cached
      const cachedData = cacheEngine.getFromCache("test-key");
      expect(cachedData).toEqual({ date: expect.any(Date), data: newData });
    });

    it("should handle errors in background refresh gracefully", async () => {
      setup();

      const mockData = { test: "data" };
      const expiredDate = new Date(Date.now() - 200 * 1000);
      const cachedObject = { date: expiredDate, data: mockData };

      cacheEngine.storeInCache("test-key", cachedObject);

      const refreshRequest = jest.fn().mockRejectedValue(new Error("Background refresh failed"));

      const result = await cacheResponse(120, "test-key", refreshRequest);

      expect(result).toEqual(mockData); // Should still return cached data
      expect(refreshRequest).toHaveBeenCalledTimes(1);

      // Wait for background refresh to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify the original cached data is still there (not overwritten with undefined)
      const cachedData = cacheEngine.getFromCache("test-key");
      expect(cachedData).toEqual(cachedObject);
    });

    it("should propagate errors when no cached data exists", async () => {
      setup();

      const error = new Error("Request failed");
      const refreshRequest = jest.fn().mockRejectedValue(error);

      await expect(cacheResponse(120, "test-key", refreshRequest)).rejects.toThrow("Request failed");
    });

    it("should not store undefined values in cache", async () => {
      setup();

      const mockData = { test: "data" };
      const expiredDate = new Date(Date.now() - 200 * 1000);
      const cachedObject = { date: expiredDate, data: mockData };

      cacheEngine.storeInCache("test-key", cachedObject);

      const refreshRequest = jest.fn().mockResolvedValue(undefined);

      const result = await cacheResponse(120, "test-key", refreshRequest);

      expect(result).toEqual(mockData); // Should still return cached data
      expect(refreshRequest).toHaveBeenCalledTimes(1);

      // Wait for background refresh to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify the original cached data is still there (not overwritten with undefined)
      const cachedData = cacheEngine.getFromCache("test-key");
      expect(cachedData).toEqual(cachedObject);
    });

    it("should prevent race conditions in cold-start path", async () => {
      setup();

      const newData = { fresh: "data" };
      let resolveRequest: (value: any) => void;
      let requestCount = 0;

      const refreshRequest = jest.fn().mockImplementation(() => {
        requestCount++;
        return new Promise(resolve => {
          resolveRequest = resolve;
        });
      });

      // Start multiple concurrent calls
      const promises = [
        cacheResponse(120, "test-key", refreshRequest),
        cacheResponse(120, "test-key", refreshRequest),
        cacheResponse(120, "test-key", refreshRequest)
      ];

      // Wait a bit to ensure all calls have started
      await new Promise(resolve => setTimeout(resolve, 10));

      // Resolve the request
      resolveRequest!(newData);

      const results = await Promise.all(promises);

      // All calls should return the same result
      expect(results).toEqual([newData, newData, newData]);

      // Only one request should have been made
      expect(requestCount).toBe(1);
      expect(refreshRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe("Memoize decorator", () => {
    it("should create cache key from class and method name", () => {
      class TestClass {
        @Memoize()
        async testMethod() {
          return "test";
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, "testMethod");

      expect(descriptor?.value).toBeDefined();
      expect(typeof descriptor?.value).toBe("function");
    });

    it("should use custom cache key when provided", () => {
      class TestClass {
        @Memoize({ key: "custom-key" })
        async testMethod() {
          return "test";
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, "testMethod");

      expect(descriptor?.value).toBeDefined();
    });

    it("should include string and number arguments in cache key", async () => {
      setup();

      class TestClass {
        @Memoize()
        async testMethod(_arg1: string, _arg2: number) {
          return "test";
        }
      }

      const instance = new TestClass();
      await instance.testMethod("test", 123);
      await instance.testMethod("test", 456);

      const cacheKeys = cacheEngine.getKeys();
      expect(cacheKeys).toHaveLength(2);
      expect(cacheKeys).toContain("TestClass#testMethod#test#123");
      expect(cacheKeys).toContain("TestClass#testMethod#test#456");
    });

    it("should filter out other types of arguments from cache key", async () => {
      setup();

      class TestClass {
        @Memoize()
        async testMethod(_arg1: string, _arg2: object) {
          return "test";
        }
      }

      const instance = new TestClass();
      await instance.testMethod("test", { test: "test1" });
      await instance.testMethod("test", { test: "test2" });

      const cacheKeys = cacheEngine.getKeys();
      expect(cacheKeys).toHaveLength(1);
      expect(cacheKeys).toContain("TestClass#testMethod#test");
    });
  });

  describe(memoizeAsync.name, () => {
    it("should cache successful results and return the same promise", async () => {
      const fn = jest.fn().mockResolvedValue("result");
      const memoized = memoizeAsync(fn);

      const result1 = await memoized();
      const result2 = await memoized();

      expect(result1).toBe("result");
      expect(result2).toBe("result");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should share the same promise for concurrent calls", async () => {
      let resolvePromise: (value: string) => void;
      const promise = new Promise<string>(resolve => {
        resolvePromise = resolve;
      });

      const fn = jest.fn().mockReturnValue(promise);
      const memoized = memoizeAsync(fn);

      const call1 = memoized();
      const call2 = memoized();
      const call3 = memoized();

      expect(fn).toHaveBeenCalledTimes(1);

      resolvePromise!("result");

      const results = await Promise.all([call1, call2, call3]);

      expect(results).toEqual(["result", "result", "result"]);
    });

    it("should not cache rejected promises", async () => {
      const error = new Error("Test error");
      const fn = jest.fn().mockRejectedValue(error);
      const memoized = memoizeAsync(fn);

      await expect(memoized()).rejects.toThrow("Test error");
      await expect(memoized()).rejects.toThrow("Test error");

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should make new requests after a rejection", async () => {
      const error = new Error("Test error");
      const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValue("success");
      const memoized = memoizeAsync(fn);

      await expect(memoized()).rejects.toThrow("Test error");

      const result = await memoized();
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should cache results for different arguments separately", async () => {
      const fn = jest.fn((arg: string) => Promise.resolve(`result-${arg}`));
      const memoized = memoizeAsync(fn as unknown as (...args: unknown[]) => Promise<unknown>) as (arg: string) => Promise<string>;

      const result1 = await memoized("a");
      const result2 = await memoized("b");
      const result3 = await memoized("a");

      expect(result1).toBe("result-a");
      expect(result2).toBe("result-b");
      expect(result3).toBe("result-a");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should handle complex arguments correctly", async () => {
      const fn = jest.fn((arg1: string, arg2: number) => Promise.resolve(`${arg1}-${arg2}`));
      const memoized = memoizeAsync(fn as unknown as (...args: unknown[]) => Promise<unknown>) as (arg1: string, arg2: number) => Promise<string>;

      const result1 = await memoized("test", 123);
      const result2 = await memoized("test", 456);
      const result3 = await memoized("test", 123);

      expect(result1).toBe("test-123");
      expect(result2).toBe("test-456");
      expect(result3).toBe("test-123");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should handle concurrent calls with rejection correctly", async () => {
      const error = new Error("Concurrent error");
      const fn = jest.fn().mockRejectedValue(error);
      const memoized = memoizeAsync(fn);

      const call1 = memoized();
      const call2 = memoized();
      const call3 = memoized();

      await expect(Promise.all([call1, call2, call3])).rejects.toThrow("Concurrent error");

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should return cached result immediately on subsequent calls", async () => {
      const fn = jest.fn().mockResolvedValue("cached");
      const memoized = memoizeAsync(fn);

      await memoized();
      const result = memoized();

      expect(result).resolves.toBe("cached");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should preserve function signature and return type", async () => {
      const fn = async (x: number): Promise<string> => Promise.resolve(`result-${x}`);
      const memoized = memoizeAsync(fn as unknown as (...args: unknown[]) => Promise<unknown>) as (x: number) => Promise<string>;

      const result = await memoized(42);

      expect(result).toBe("result-42");
      expect(typeof result).toBe("string");
    });
  });

  function setup() {
    jest.clearAllMocks();
    cacheEngine.clearAllKeyInCache();
  }
});
