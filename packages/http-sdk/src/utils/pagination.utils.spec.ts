import { describe, expect, it, vi } from "vitest";

import { getAllItems } from "./pagination.utils";

describe("Pagination utils", () => {
  describe(getAllItems.name, () => {
    it("returns all items", async () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      const getItems = vi.fn(async (params: Record<string, string | number>) => {
        const startIndex = params["pagination.key"] ? Number(params["pagination.key"]) : 0;
        const endIndex = startIndex + 20;
        return {
          items: items.slice(startIndex, endIndex),
          pagination: { next_key: endIndex < items.length ? String(endIndex) : null }
        };
      });
      const allItems = await getAllItems(getItems);

      expect(allItems).toEqual(items);
    });

    it("detects cyclic loop and logs an error", async () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      const getItems = vi.fn(async () => {
        return { items: items.slice(0, 20), pagination: { next_key: "0" } };
      });
      const logger = { error: vi.fn() };
      const allItems = await getAllItems(getItems, logger);

      expect(allItems).toEqual(items.slice(0, 20));
      expect(getItems).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "HTTP_SDK_CIRCULAR_LOOP" }));
    });

    it("does not report cyclic loop if the next key is null", async () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      const getItems = vi.fn(async () => {
        return { items, pagination: { next_key: null } };
      });
      const logger = { error: vi.fn() };
      const allItems = await getAllItems(getItems, logger);

      expect(allItems).toEqual(items);
      expect(getItems).toHaveBeenCalledTimes(1);
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
