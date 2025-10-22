import { useCallback, useMemo, useState } from "react";
import intersection from "lodash/intersection";
import uniq from "lodash/uniq";

export type UseListSelectionProps<T> = {
  ids: T[];
};

export const useListSelection = <T>({ ids }: UseListSelectionProps<T>) => {
  const [selectedItemIds, setSelectedItemIds] = useState<T[]>([]);
  const [intervalSelectionAnchor, setIntervalSelectionAnchor] = useState<T | null>(null);
  const [lastIntervalSelectionIds, setLastIntervalSelectionIds] = useState<T[]>([]);

  const indexOfId = useCallback(
    (id: T) => {
      return ids?.findIndex(currentId => currentId === id);
    },
    [ids]
  );

  const isBetweenIds = useCallback(
    (id: T, idA: T, idB: T) => {
      const idIndex = indexOfId(id);
      const idAIndex = indexOfId(idA);
      const idBIndex = indexOfId(idB);

      return (
        idIndex !== -1 && idAIndex !== -1 && idBIndex !== -1 && ((idAIndex <= idIndex && idIndex <= idBIndex) || (idAIndex >= idIndex && idIndex >= idBIndex))
      );
    },
    [indexOfId]
  );

  const itemsBetween = useCallback(
    (idA: T, idB: T) => {
      return ids.filter(currentId => isBetweenIds(currentId, idA, idB));
    },
    [ids, isBetweenIds]
  );

  const toggleSingleSelection = useCallback((id: T) => {
    setSelectedItemIds(prev => {
      const isAdding = !prev.includes(id);
      if (isAdding) {
        setIntervalSelectionAnchor(id);
      }

      return isAdding ? [...prev, id] : prev.filter(x => x !== id);
    });
  }, []);

  const changeMultipleSelection = useCallback(
    (id: T) => {
      const newRange = itemsBetween(id, intervalSelectionAnchor!);

      if (id === intervalSelectionAnchor && lastIntervalSelectionIds.length > 0) {
        setSelectedItemIds(prev => prev.filter(x => !lastIntervalSelectionIds.includes(x)));
        setLastIntervalSelectionIds([]);
        return;
      }

      setSelectedItemIds(prev => uniq([...prev, ...newRange]));
      setLastIntervalSelectionIds(newRange);
    },
    [intervalSelectionAnchor, itemsBetween, lastIntervalSelectionIds]
  );

  const selectItem = useCallback(
    ({ id, isShiftPressed }: { id: T; isShiftPressed: boolean }) => {
      if (intervalSelectionAnchor && isShiftPressed) {
        changeMultipleSelection(id);
      } else {
        toggleSingleSelection(id);
      }
    },
    [intervalSelectionAnchor, changeMultipleSelection, toggleSingleSelection]
  );

  const clearSelection = useCallback(() => {
    setSelectedItemIds([]);
  }, []);

  const validSelectedItemIds = useMemo(() => {
    return intersection(ids, selectedItemIds);
  }, [ids, selectedItemIds]);

  return useMemo(
    () => ({
      selectedItemIds: validSelectedItemIds,
      selectItem,
      clearSelection,
      setSelectedItemIds
    }),
    [validSelectedItemIds, selectItem, clearSelection]
  );
};
