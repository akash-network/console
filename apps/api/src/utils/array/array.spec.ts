import { setTimeout as wait } from "node:timers/promises";

import { createFilterUnique, forEachInChunks } from "./array";

describe("array helpers", () => {
  describe(createFilterUnique.name, () => {
    it("returns a functioning unique filter with default equality matcher", () => {
      const arrayWithDuplicate = [1, 2, 2, 3, 3, 3];
      const expected = [1, 2, 3];

      expect(arrayWithDuplicate.filter(createFilterUnique())).toEqual(expected);
    });

    it("should return a functionning unique filter with custom matcher", () => {
      const arrayWithDuplicate = [{ v: 1 }, { v: 2 }, { v: 2 }, { v: 3 }, { v: 3 }, { v: 3 }];
      const expected = [{ v: 1 }, { v: 2 }, { v: 3 }];

      expect(arrayWithDuplicate.filter(createFilterUnique((a, b) => a.v === b.v))).toEqual(expected);
    });
  });

  describe(forEachInChunks.name, () => {
    it("iterates over the array in chunks with specified time limit per chunk", async () => {
      const array = Array.from({ length: 100_000 }, (_, i) => i);
      const anotherTask = jest.fn();
      let currentIndex = 0;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, timeoutResult] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        forEachInChunks(
          array,
          (_, index) => {
            currentIndex = index;
          },
          { maxTimeSpentPerChunk: 1 }
        ),
        wait(0).then(() => currentIndex),
        queueMicrotask(() => anotherTask(currentIndex))
      ]);
      // if it's the last index, then forEachInChunks didn't wait for the next chunk
      expect(timeoutResult).not.toBe(array.length - 1);
      expect(anotherTask.mock.calls[0][0]).not.toBe(array.length - 1);
      expect(currentIndex).toEqual(array.length - 1);
    });
  });
});
