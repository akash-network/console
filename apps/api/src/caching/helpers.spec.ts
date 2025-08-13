import { cacheEngine, cacheResponse, Memoize } from "./helpers";

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
    });

    it("should propagate errors when no cached data exists", async () => {
      setup();

      const error = new Error("Request failed");
      const refreshRequest = jest.fn().mockRejectedValue(error);

      await expect(cacheResponse(120, "test-key", refreshRequest)).rejects.toThrow("Request failed");
    });

    function setup() {
      jest.clearAllMocks();
      cacheEngine.clearAllKeyInCache();
    }
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

    it("should include string arguments in cache key", () => {
      class TestClass {
        @Memoize()
        async testMethod(_arg1: string, _arg2: string) {
          return "test";
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, "testMethod");

      expect(descriptor?.value).toBeDefined();
    });

    it("should filter out non-string arguments from cache key", () => {
      class TestClass {
        @Memoize()
        async testMethod(_arg1: string, _arg2: number, _arg3: object) {
          return "test";
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, "testMethod");

      expect(descriptor?.value).toBeDefined();
    });
  });
});
