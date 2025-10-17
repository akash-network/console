import { range } from "lodash";

import type { UseListSelectionProps } from "./useListSelection";
import { useListSelection } from "./useListSelection";

import { act, renderHook, waitFor } from "@testing-library/react";

const expectSelectedItems = (actualIds: number[], expectedIds: number[]) => {
  expect(actualIds.length).toBe(expectedIds.length);
  expect(expectedIds.every(id => actualIds.includes(id))).toBe(true);
};

describe(useListSelection.name, () => {
  it("should not explode for an empty list", () => {
    const hook = setup({ ids: [] });

    expect(hook.selectedItemIds).toEqual([]);
  });

  [
    {
      name: "can set a single item as selected",
      clicks: [{ id: 2, isShiftPressed: false }],
      expectedItems: [2]
    },
    {
      name: "can select multiple items, toggling back and forth",
      clicks: [
        { id: 2, isShiftPressed: false },
        { id: 3, isShiftPressed: false },
        { id: 4, isShiftPressed: false },
        { id: 3, isShiftPressed: false }
      ],
      expectedItems: [2, 4]
    },
    {
      name: "can shift-select first item",
      clicks: [{ id: 2, isShiftPressed: true }],
      expectedItems: [2]
    },
    {
      name: "can shift-select items down",
      clicks: [
        { id: 2, isShiftPressed: false },
        { id: 4, isShiftPressed: true }
      ],
      expectedItems: [2, 3, 4]
    },
    {
      name: "can shift-select items up",
      clicks: [
        { id: 4, isShiftPressed: false },
        { id: 2, isShiftPressed: true }
      ],
      expectedItems: [2, 3, 4]
    },
    {
      name: "can shift-select down and then up",
      clicks: [
        { id: 2, isShiftPressed: false },
        { id: 4, isShiftPressed: true },
        { id: 0, isShiftPressed: true }
      ],
      expectedItems: [0, 1, 2, 3, 4]
    },
    {
      name: "can shift-select up and then down",
      clicks: [
        { id: 2, isShiftPressed: false },
        { id: 0, isShiftPressed: true },
        { id: 4, isShiftPressed: true }
      ],
      expectedItems: [0, 1, 2, 3, 4]
    },
    {
      name: "can deselect the whole range up",
      clicks: [
        { id: 2, isShiftPressed: false },
        { id: 4, isShiftPressed: true },
        { id: 2, isShiftPressed: true }
      ],
      expectedItems: []
    },
    {
      name: "can deselect the whole range down",
      clicks: [
        { id: 4, isShiftPressed: false },
        { id: 2, isShiftPressed: true },
        { id: 4, isShiftPressed: true }
      ],
      expectedItems: []
    },
    {
      name: "can mark even more items down",
      clicks: [
        { id: 2, isShiftPressed: false },
        { id: 4, isShiftPressed: true },
        { id: 0, isShiftPressed: true },
        { id: 6, isShiftPressed: true }
      ],
      expectedItems: [0, 1, 2, 3, 4, 5, 6]
    },
    {
      name: "can mark even more items up",
      clicks: [
        { id: 4, isShiftPressed: false },
        { id: 6, isShiftPressed: true },
        { id: 2, isShiftPressed: true },
        { id: 0, isShiftPressed: true }
      ],
      expectedItems: [0, 1, 2, 3, 4, 5, 6]
    }
  ].forEach(({ name, clicks, expectedItems }) => {
    it(name, async () => {
      const { result } = renderHook(() => useListSelection({ ids: range(0, 10) }));

      clicks.forEach(({ id, isShiftPressed }) => {
        act(() => {
          result.current.onSelectItem({ id, isShiftPressed });
        });
      });

      await waitFor(() => {
        expectSelectedItems(result.current.selectedItemIds, expectedItems);
      });
    });
  });

  function setup({ ids }: UseListSelectionProps<number> = { ids: range(0, 10) }) {
    const res = renderHook(() => useListSelection({ ids }));

    return res.result.current;
  }
});
