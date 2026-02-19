import { range } from "lodash";
import { describe, expect, it, vi } from "vitest";

import type { UseListSelectionProps } from "./useListSelection";
import { useListSelection } from "./useListSelection";

import { act, renderHook } from "@testing-library/react";

const expectSelectedItems = (actualIds: number[], expectedIds: number[]) => {
  expect(actualIds.length).toBe(expectedIds.length);
  expect(actualIds).toEqual(expect.arrayContaining(expectedIds));
};

type Click = {
  id: number;
  isShiftPressed: boolean;
};

type TestConfig = {
  clicks: Click[];
  expectedItems: number[];
};

const testSelection = async (config: TestConfig) => {
  const result = setup();

  config.clicks.forEach(({ id, isShiftPressed }) => {
    act(() => {
      result.current.selectItem({ id, isShiftPressed });
    });
  });

  await vi.waitFor(() => {
    expectSelectedItems(result.current.selectedItemIds, config.expectedItems);
  });
};

describe(useListSelection.name, () => {
  it("should not explode for an empty list", () => {
    const result = setup({ ids: [] });
    expect(result.current.selectedItemIds).toEqual([]);
  });

  it("can set a single item as selected", async () => {
    await testSelection({
      clicks: [{ id: 2, isShiftPressed: false }],
      expectedItems: [2]
    });
  });

  it("can select multiple items, toggling back and forth", async () => {
    await testSelection({
      clicks: [
        { id: 2, isShiftPressed: false },
        { id: 3, isShiftPressed: false },
        { id: 4, isShiftPressed: false },
        { id: 3, isShiftPressed: false }
      ],
      expectedItems: [2, 4]
    });
  });

  it("can shift-select first item", async () => {
    await testSelection({
      clicks: [{ id: 2, isShiftPressed: true }],
      expectedItems: [2]
    });
  });

  it("can shift-select items down", async () => {
    await testSelection({
      clicks: [
        { id: 2, isShiftPressed: false },
        { id: 4, isShiftPressed: true }
      ],
      expectedItems: [2, 3, 4]
    });
  });

  it("can shift-select items up", async () => {
    await testSelection({
      clicks: [
        { id: 4, isShiftPressed: false },
        { id: 2, isShiftPressed: true }
      ],
      expectedItems: [2, 3, 4]
    });
  });

  it("can shift-select down and then up", async () => {
    await testSelection({
      clicks: [
        { id: 2, isShiftPressed: false },
        { id: 4, isShiftPressed: true },
        { id: 0, isShiftPressed: true }
      ],
      expectedItems: [0, 1, 2, 3, 4]
    });
  });

  it("can shift-select up and then down", async () => {
    await testSelection({
      clicks: [
        { id: 2, isShiftPressed: false },
        { id: 0, isShiftPressed: true },
        { id: 4, isShiftPressed: true }
      ],
      expectedItems: [0, 1, 2, 3, 4]
    });
  });

  it("can deselect the whole range up", async () => {
    await testSelection({
      clicks: [
        { id: 2, isShiftPressed: false },
        { id: 4, isShiftPressed: true },
        { id: 2, isShiftPressed: true }
      ],
      expectedItems: []
    });
  });

  it("can deselect the whole range down", async () => {
    await testSelection({
      clicks: [
        { id: 4, isShiftPressed: false },
        { id: 2, isShiftPressed: true },
        { id: 4, isShiftPressed: true }
      ],
      expectedItems: []
    });
  });

  it("can mark even more items down", async () => {
    await testSelection({
      clicks: [
        { id: 2, isShiftPressed: false },
        { id: 4, isShiftPressed: true },
        { id: 0, isShiftPressed: true },
        { id: 6, isShiftPressed: true }
      ],
      expectedItems: [0, 1, 2, 3, 4, 5, 6]
    });
  });

  it("can mark even more items up", async () => {
    await testSelection({
      clicks: [
        { id: 4, isShiftPressed: false },
        { id: 6, isShiftPressed: true },
        { id: 2, isShiftPressed: true },
        { id: 0, isShiftPressed: true }
      ],
      expectedItems: [0, 1, 2, 3, 4, 5, 6]
    });
  });
});

function setup({ ids }: UseListSelectionProps<number> = { ids: range(0, 10) }) {
  const { result } = renderHook(() => useListSelection({ ids }));
  return result;
}
