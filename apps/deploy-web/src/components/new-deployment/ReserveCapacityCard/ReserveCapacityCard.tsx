"use client";
import type { FC } from "react";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useMediaQuery } from "@akashnetwork/ui/hooks";
import { cn } from "@akashnetwork/ui/utils";
import { ArrowRight } from "lucide-react";

import { GPU_CATALOG } from "@src/components/gpu-requests/gpuQuoteDraft/gpuQuoteCatalog";

export const DEPENDENCIES = { useMediaQuery };

export const STACK_CYCLE_MS = 4200;

export const STACK_DROP_MS = 460;

const STACKED_GPUS = ["b300", "h200", "h100", "a100"].map(id => GPU_CATALOG.find(gpu => gpu.id === id)!);

/** Slots run from the front card back; each sits up, right and smaller than the one before it. */
const SLOT_CLASSES = [
  "z-10 [transform:translate(0px,0px)_scale(1)_skewY(5deg)]",
  "z-[9] [transform:translate(28px,-24px)_scale(0.94)_skewY(5deg)]",
  "z-[8] [transform:translate(56px,-48px)_scale(0.88)_skewY(5deg)]",
  "z-[7] [transform:translate(84px,-72px)_scale(0.82)_skewY(5deg)]"
];

const SLOT_TRANSITION_CLASSES = [
  "[transition:transform_620ms_cubic-bezier(0.22,1,0.36,1)_50ms]",
  "[transition:transform_620ms_cubic-bezier(0.22,1,0.36,1)_120ms]",
  "[transition:transform_620ms_cubic-bezier(0.22,1,0.36,1)_190ms]",
  "[transition:transform_620ms_cubic-bezier(0.22,1,0.36,1)_260ms]"
];

const DROPPING_CLASSES =
  "pointer-events-none z-20 [transform:translate(-8px,236px)_rotate(-4deg)_skewY(5deg)] [transition:transform_460ms_cubic-bezier(0.55,0,0.85,0.3)]";

const RETURNING_TRANSITION_CLASSES = "[transition:transform_760ms_cubic-bezier(0.22,1,0.36,1)]";

type Stack = { order: string[]; isDropping: boolean; returningId: string | null };

type Props = { onRequestQuote: () => void; dependencies?: typeof DEPENDENCIES };

export const ReserveCapacityCard: FC<Props> = ({ onRequestQuote, dependencies: d = DEPENDENCIES }) => {
  const titleId = useId();
  const descriptionId = useId();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <section
      aria-labelledby={titleId}
      onClick={onRequestQuote}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative isolate flex min-h-[262px] flex-1 cursor-pointer flex-col overflow-hidden rounded-[14px] border border-neutral-950 bg-[#0C0C0E] bg-[radial-gradient(380px_260px_at_86%_100%,rgba(255,255,255,0.08),transparent_70%)] text-neutral-50 shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-14px_rgba(0,0,0,0.5),0_0_0_1px_rgba(37,99,235,0.45)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-zinc-800 dark:bg-[#121214]"
    >
      <div className="pointer-events-none relative z-30 px-5 pt-5">
        <h3 id={titleId} className="text-[17px] font-bold leading-[22px] tracking-[-0.015em]">
          Reserve capacity
        </h3>
        <p id={descriptionId} className="mt-1.5 line-clamp-2 max-w-[220px] text-[13px] leading-[19px] text-neutral-50/65">
          Commit to a term for guaranteed GPUs at a lower rate.
        </p>
      </div>
      <GpuCardStack isPaused={isHovered} dependencies={d} />
      <button
        type="button"
        aria-describedby={descriptionId}
        className="absolute bottom-[18px] left-5 z-30 inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-neutral-50 px-3 text-[13px] font-medium text-neutral-950 transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
      >
        Get a quote
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </section>
  );
};

/** The front card drops out of the panel and returns to the back; it holds still while paused, hidden or asked to reduce motion. */
export const GpuCardStack: FC<{ isPaused: boolean; dependencies?: typeof DEPENDENCIES }> = ({ isPaused, dependencies: d = DEPENDENCIES }) => {
  const prefersReducedMotion = d.useMediaQuery("(prefers-reduced-motion: reduce)");
  const isPageVisible = useIsPageVisible();
  const isMoving = !isPaused && !prefersReducedMotion && isPageVisible;
  const [stack, setStack] = useState<Stack>(() => ({ order: STACKED_GPUS.map(gpu => gpu.id), isDropping: false, returningId: null }));

  useEffect(
    function cycleFrontCardToBack() {
      if (!isMoving) return;

      let dropTimer: ReturnType<typeof setTimeout> | undefined;
      const cycleTimer = setInterval(() => {
        setStack(current => ({ ...current, isDropping: true, returningId: null }));
        dropTimer = setTimeout(() => setStack(sendFrontCardToBack), STACK_DROP_MS);
      }, STACK_CYCLE_MS);

      return function stopCycling() {
        clearInterval(cycleTimer);
        clearTimeout(dropTimer);
        setStack(sendFrontCardToBack);
      };
    },
    [isMoving]
  );

  return (
    <div aria-hidden="true" className="absolute -bottom-6 right-[30px] h-[114px] w-[180px]">
      {STACKED_GPUS.map(gpu => {
        const position = stack.order.indexOf(gpu.id);
        const isDropping = stack.isDropping && position === 0;
        const slot = stack.isDropping ? position - 1 : position;

        return (
          <div
            key={gpu.id}
            data-slot={isDropping ? "dropping" : slot}
            className={cn(
              "absolute inset-0 will-change-transform motion-reduce:!transition-none",
              isDropping ? DROPPING_CLASSES : SLOT_CLASSES[slot],
              !isDropping && (gpu.id === stack.returningId ? RETURNING_TRANSITION_CLASSES : SLOT_TRANSITION_CLASSES[slot])
            )}
          >
            <div className="absolute inset-0 flex flex-col rounded-xl border border-white/15 bg-gradient-to-b from-[#1C1C20] to-[#0F0F11] px-4 py-3.5 shadow-[0_16px_32px_-16px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[transform,border-color] duration-200 hover:-translate-y-1.5 hover:border-white/45 motion-reduce:transition-none">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-neutral-50/55">{gpu.vendor}</span>
              <span className="mt-1.5 text-[28px] font-bold leading-8 tracking-[-0.02em]">{gpu.label}</span>
              <span className="mt-0.5 whitespace-nowrap font-mono text-[11px] leading-[15px] text-neutral-50/60">
                {gpu.memory} {gpu.memoryType}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

function sendFrontCardToBack(stack: Stack): Stack {
  if (!stack.isDropping) return stack;

  const [front, ...rest] = stack.order;
  return { order: [...rest, front], isDropping: false, returningId: front };
}

function useIsPageVisible(): boolean {
  return useSyncExternalStore(subscribeToPageVisibility, isPageVisible, isPageVisibleOnServer);
}

function subscribeToPageVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function isPageVisible(): boolean {
  return document.visibilityState === "visible";
}

function isPageVisibleOnServer(): boolean {
  return false;
}
