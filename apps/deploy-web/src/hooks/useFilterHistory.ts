import { useCallback, useState } from "react";

import type { SdlBuilderFormValuesType } from "@src/types";
import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";

export type FilterSnapshot = {
  formValues: SdlBuilderFormValuesType;
  placementFilters: PlacementFilters;
  timestamp: number;
  resultCount: number;
};

const MAX_SNAPSHOTS = 20;

export function useFilterHistory(initialFormValues: SdlBuilderFormValuesType, initialPlacement: PlacementFilters, initialResultCount: number) {
  const [state, setState] = useState<{ stack: FilterSnapshot[]; current: number }>(() => ({
    stack: [
      {
        formValues: structuredClone(initialFormValues),
        placementFilters: structuredClone(initialPlacement),
        timestamp: Date.now(),
        resultCount: initialResultCount
      }
    ],
    current: 0
  }));

  const apply = useCallback((formValues: SdlBuilderFormValuesType, placement: PlacementFilters, resultCount: number) => {
    setState(prev => {
      const truncated = prev.stack.slice(0, prev.current + 1);
      const next: FilterSnapshot = {
        formValues: structuredClone(formValues),
        placementFilters: structuredClone(placement),
        timestamp: Date.now(),
        resultCount
      };
      const newStack = [...truncated, next];

      if (newStack.length > MAX_SNAPSHOTS) {
        const overflow = newStack.length - MAX_SNAPSHOTS;
        return { stack: newStack.slice(overflow), current: newStack.length - overflow - 1 };
      }

      return { stack: newStack, current: newStack.length - 1 };
    });
  }, []);

  const undo = useCallback((): FilterSnapshot | null => {
    let target: FilterSnapshot | null = null;
    setState(prev => {
      const nextIndex = Math.max(0, prev.current - 1);
      target = prev.stack[nextIndex] ?? null;
      return { ...prev, current: nextIndex };
    });
    return target;
  }, []);

  const redo = useCallback((): FilterSnapshot | null => {
    let target: FilterSnapshot | null = null;
    setState(prev => {
      const nextIndex = Math.min(prev.stack.length - 1, prev.current + 1);
      target = prev.stack[nextIndex] ?? null;
      return { ...prev, current: nextIndex };
    });
    return target;
  }, []);

  const pendingChanges = useCallback(
    (currentFormValues: SdlBuilderFormValuesType, currentPlacement: PlacementFilters): number => {
      const snapshot = state.stack[state.current];
      if (!snapshot) return 0;

      const currentJson = JSON.stringify({ f: currentFormValues.services, p: currentPlacement });
      const snapshotJson = JSON.stringify({ f: snapshot.formValues.services, p: snapshot.placementFilters });
      return currentJson === snapshotJson ? 0 : 1;
    },
    [state.stack, state.current]
  );

  return {
    snapshots: state.stack,
    currentIndex: state.current,
    currentSnapshot: state.stack[state.current],
    canUndo: state.current > 0,
    canRedo: state.current < state.stack.length - 1,
    apply,
    undo,
    redo,
    pendingChanges
  };
}
