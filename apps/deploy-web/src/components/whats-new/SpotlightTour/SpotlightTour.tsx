"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@akashnetwork/ui/components";
import { useMediaQuery } from "@akashnetwork/ui/hooks";
import { cn } from "@akashnetwork/ui/utils";
import { MousePointer, MousePointerClick, X } from "lucide-react";

import type { Box, CoachPlacement, CoachSide } from "./placeCoachCard";
import { placeCoachCard } from "./placeCoachCard";
import type { Hole } from "./spotlightHole";
import { blockersAround, glideHole, hasReached, holeAround, isSameHole, roundedRectPath, roundToPixels } from "./spotlightHole";
import styles from "./SpotlightTour.module.css";

export type TourStep = {
  id: string;
  title: string;
  body: string;
  hint: string;
  hintIcon: "hover" | "click";
  placement: CoachSide;
  padding: number;
  radius: number;
  /** "advance" moves on when the highlighted control is clicked; "swallow" keeps the user on the page while they explore it. */
  onTargetClick: "advance" | "swallow";
  findTarget: () => HTMLElement | null;
  /** Brings the target on screen, e.g. by navigating or opening its menu, once it has been missing for a few frames. */
  prepare?: () => void;
};

export type TourOutcome = { stepId: string; isCompleted: boolean };

export const DEPENDENCIES = { useMediaQuery };

type Props = {
  steps: TourStep[];
  isOpen: boolean;
  /** The announcement card's box: the first hole opens there and glides to its target once the card has faded. */
  origin: Box | null;
  onEnd: (outcome: TourOutcome) => void;
  dependencies?: typeof DEPENDENCIES;
};

const ORIGIN_HOLD_MS = 220;
const MISSING_FRAMES_BEFORE_PREPARING = 3;
const MISSING_FRAMES_BEFORE_DROPPING_HOLE = 40;
const MAX_FRAME_SECONDS = 0.05;
/** Lets the click reach the control, e.g. to open its menu, before the tour moves its hole. */
const ADVANCE_AFTER_CLICK_MS = 30;
const CARD_MAX_WIDTH = 320;
const CARD_ESTIMATED_HEIGHT = 190;
const ANOTHER_OPEN_DIALOG = '[role="dialog"][data-state="open"]:not([data-whats-new]), [role="alertdialog"][data-state="open"]';

const HINT_ICON = { hover: MousePointer, click: MousePointerClick };

/** Dims the page around the real control each step points at, and steps aside while another dialog is open. */
export function SpotlightTour({ isOpen, ...props }: Props) {
  if (!isOpen) return null;
  return <OpenSpotlightTour {...props} />;
}

function OpenSpotlightTour({ steps, origin, onEnd, dependencies: d = DEPENDENCIES }: Omit<Props, "isOpen">) {
  const prefersReducedMotion = d.useMediaQuery("(prefers-reduced-motion: reduce)");
  const [stepIndex, setStepIndex] = useState(0);
  const [hole, setHole] = useState<Hole | null>(() => (origin ? { ...origin, radius: 16 } : null));
  const [holdOriginUntil] = useState(() => (origin ? performance.now() + ORIGIN_HOLD_MS : 0));
  const [isBehindAnotherDialog, setIsBehindAnotherDialog] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [cardHeight, setCardHeight] = useState(CARD_ESTIMATED_HEIGHT);
  const [viewport, setViewport] = useState(readViewport);
  const shownHoleRef = useRef(hole);
  const hasArrivedRef = useRef(false);
  const targetRef = useRef<HTMLElement | null>(null);
  const stepIndexRef = useRef(stepIndex);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  useEffect(
    function trackCurrentStepForListeners() {
      stepIndexRef.current = stepIndex;
    },
    [stepIndex]
  );

  const goTo = useCallback(
    (index: number) => {
      if (index < 0) return;
      if (index >= steps.length) onEnd({ stepId: steps[steps.length - 1].id, isCompleted: true });
      else setStepIndex(index);
    },
    [steps, onEnd]
  );

  const skip = useCallback(() => onEnd({ stepId: steps[stepIndexRef.current].id, isCompleted: false }), [steps, onEnd]);

  useEffect(
    function followTheStepTargetEveryFrame() {
      let frame = 0;
      let missingFrames = 0;
      let hasPrepared = false;
      let lastFrameAt = performance.now();

      const markArrived = () => {
        if (hasArrivedRef.current) return;
        hasArrivedRef.current = true;
        setHasArrived(true);
      };

      const showHole = (next: Hole | null) => {
        if (isSameHole(shownHoleRef.current, next)) return;
        shownHoleRef.current = next;
        setHole(next);
      };

      const follow = (now: number) => {
        const elapsedSeconds = Math.min(MAX_FRAME_SECONDS, (now - lastFrameAt) / 1000);
        lastFrameAt = now;
        const isCovered = !!document.querySelector(ANOTHER_OPEN_DIALOG);
        setIsBehindAnotherDialog(isCovered);
        const target = isCovered ? null : step.findTarget();
        targetRef.current = target;
        const rect = target?.getBoundingClientRect();

        if (rect && rect.width > 0) {
          missingFrames = 0;
          hasPrepared = false;
          const shown = shownHoleRef.current;
          const goal = shown && now < holdOriginUntil ? shown : holeAround(rect, step.padding, step.radius);
          const next = shown && !prefersReducedMotion ? glideHole(shown, goal, elapsedSeconds) : goal;
          showHole(next);
          if (now >= holdOriginUntil && hasReached(next, goal)) markArrived();
        } else if (!isCovered) {
          missingFrames++;
          if (missingFrames > MISSING_FRAMES_BEFORE_PREPARING && !hasPrepared && step.prepare) {
            hasPrepared = true;
            step.prepare();
          }
          if (missingFrames > MISSING_FRAMES_BEFORE_DROPPING_HOLE) {
            showHole(null);
            markArrived();
          }
        }

        frame = requestAnimationFrame(follow);
      };

      frame = requestAnimationFrame(follow);
      return function stopFollowing() {
        cancelAnimationFrame(frame);
      };
    },
    [step, prefersReducedMotion, holdOriginUntil]
  );

  useEffect(
    function letTheControlAndKeysDriveTheTour() {
      const handleClick = (event: MouseEvent) => {
        const target = targetRef.current;
        if (!target || !(event.target instanceof Node) || !target.contains(event.target)) return;
        if (steps[stepIndexRef.current].onTargetClick === "swallow") {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        setTimeout(() => goTo(stepIndexRef.current + 1), ADVANCE_AFTER_CLICK_MS);
      };
      const handleKeyDown = (event: KeyboardEvent) => {
        if (document.querySelector(ANOTHER_OPEN_DIALOG)) return;
        if (event.key === "Escape") skip();
        else if (event.key === "ArrowRight") goTo(stepIndexRef.current + 1);
        else if (event.key === "ArrowLeft") goTo(stepIndexRef.current - 1);
      };
      const handleResize = () => setViewport(readViewport());

      document.addEventListener("click", handleClick, true);
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("resize", handleResize);
      return function stopListening() {
        document.removeEventListener("click", handleClick, true);
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("resize", handleResize);
      };
    },
    [steps, goTo, skip]
  );

  useLayoutEffect(function measureCoachCardHeight() {
    const height = cardRef.current?.offsetHeight;
    if (height && Math.abs(height - cardHeight) > 1) setCardHeight(height);
  });

  if (isBehindAnotherDialog) return null;

  const cardWidth = Math.min(CARD_MAX_WIDTH, viewport.width - 16);
  const shownHole = hole && roundToPixels(hole);
  const placement: CoachPlacement = shownHole
    ? placeCoachCard(shownHole, step.placement, { width: cardWidth, height: cardHeight }, viewport)
    : { side: "none", x: (viewport.width - cardWidth) / 2, y: (viewport.height - cardHeight) / 2, arrowX: null, arrowY: null };
  const isLastStep = stepIndex === steps.length - 1;
  const HintIcon = HINT_ICON[step.hintIcon];

  return createPortal(
    <div className={cn(styles.tour, origin && styles.fromAnnouncement)} data-whats-new="">
      <svg className={styles.dim} width={viewport.width} height={viewport.height} aria-hidden="true">
        <path fillRule="evenodd" d={`M0 0H${viewport.width}V${viewport.height}H0Z${shownHole ? roundedRectPath(shownHole) : ""}`} />
      </svg>

      {shownHole ? (
        <>
          {blockersAround(shownHole).map((style, index) => (
            <div key={index} className={styles.blocker} style={style} />
          ))}
          {hasArrived && (
            <div
              className={styles.ring}
              style={{ left: shownHole.x, top: shownHole.y, width: shownHole.width, height: shownHole.height, borderRadius: shownHole.radius }}
            />
          )}
        </>
      ) : (
        <div className={styles.blocker} style={{ inset: 0 }} />
      )}

      {hasArrived && (
        <div
          ref={cardRef}
          role="dialog"
          aria-label={step.title}
          data-whats-new=""
          data-side={placement.side}
          className={styles.coach}
          style={{ left: placement.x, top: placement.y, width: cardWidth }}
        >
          {placement.side !== "none" && (
            <span className={styles.arrow} style={placement.arrowX !== null ? { left: placement.arrowX - 6 } : { top: (placement.arrowY ?? 0) - 6 }} />
          )}
          <div className="-mr-2 -mt-1 mb-1.5 flex items-center justify-between gap-2">
            <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
              What&apos;s new · {stepIndex + 1} of {steps.length}
            </span>
            <button
              type="button"
              aria-label="Skip tour"
              className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted"
              onClick={skip}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div key={step.id} className={styles.stepCopy}>
            <h2 className="text-balance text-[15px] font-semibold leading-[1.3] tracking-[-0.01em]">{step.title}</h2>
            <p className="mt-1 text-pretty text-[13px] leading-[19px] text-muted-foreground">{step.body}</p>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-2.5 py-2 text-[12.5px] leading-[17px]">
              <HintIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">{step.hint}</span>
            </div>
          </div>

          <div className="mt-3.5 flex items-center gap-1.5">
            <span className="flex flex-1 items-center gap-1" aria-hidden="true">
              {steps.map(({ id }) => (
                <i key={id} className={styles.dot} data-current={id === step.id} />
              ))}
            </span>
            {stepIndex > 0 && (
              <Button variant="ghost" size="sm" className="h-[30px] rounded-lg text-[13px] text-muted-foreground" onClick={() => goTo(stepIndex - 1)}>
                Back
              </Button>
            )}
            <Button size="sm" className="h-[30px] rounded-lg text-[13px]" onClick={() => goTo(stepIndex + 1)}>
              {isLastStep ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

function readViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}
