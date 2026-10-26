"use client";
import type { KeyboardEvent, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { Button, Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogPrimitiveContent, DialogTitle } from "@akashnetwork/ui/components";
import { useMediaQuery } from "@akashnetwork/ui/hooks";
import { cn } from "@akashnetwork/ui/utils";
import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";

import type { WhatsNewRelease } from "../organizationsRelease";
import type { Box } from "../SpotlightTour/placeCoachCard";
import { SCENES } from "../WhatsNewScenes/scenes";
import { WhatsNewScene } from "../WhatsNewScenes/WhatsNewScene";
import { useElementWidth } from "./useElementWidth";
import { useSceneClock } from "./useSceneClock";
import styles from "./WhatsNewModal.module.css";

export const DEPENDENCIES = { useMediaQuery, useSceneClock, useElementWidth, WhatsNewScene };

type Props = {
  release: WhatsNewRelease;
  isOpen: boolean;
  /** Drops the backdrop at once so the tour's dim takes over while the card fades out above it. */
  isHandingOffToTour: boolean;
  onClose: () => void;
  onTryIt: (cardBox: Box | null) => void;
  dependencies?: typeof DEPENDENCIES;
};

const OVERLAY_CLASSES = "z-[1700] bg-[rgba(0,0,0,0.45)] backdrop-blur-none duration-200";

const CARD_CLASSES =
  "fixed inset-0 z-[1700] m-auto flex h-fit flex-col overflow-y-auto overflow-x-hidden rounded-2xl border bg-background text-foreground shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)] outline-none data-[state=closed]:duration-200 data-[state=open]:duration-[340ms] data-[state=open]:ease-[cubic-bezier(0.2,0.8,0.2,1)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.985] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=open]:slide-in-from-bottom-2.5";

/** Announces a release as a few illustrated slides; "Try it now" hands over to a tour of the real controls. */
export function WhatsNewModal({ release, isOpen, isHandingOffToTour, onClose, onTryIt, dependencies: d = DEPENDENCIES }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef<HTMLDivElement>(null);

  const focusSlidesInsteadOfCloseButton = (event: Event) => {
    event.preventDefault();
    slidesRef.current?.focus();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className={cn(OVERLAY_CLASSES, isHandingOffToTour && "data-[state=closed]:hidden")} />
        <DialogPrimitiveContent ref={cardRef} data-whats-new="" className={cn(CARD_CLASSES, styles.card)} onOpenAutoFocus={focusSlidesInsteadOfCloseButton}>
          <Slides release={release} cardRef={cardRef} slidesRef={slidesRef} onClose={onClose} onTryIt={onTryIt} dependencies={d} />
        </DialogPrimitiveContent>
      </DialogPortal>
    </Dialog>
  );
}

type SlidesProps = Pick<Props, "release" | "onClose" | "onTryIt"> & {
  cardRef: RefObject<HTMLDivElement>;
  slidesRef: RefObject<HTMLDivElement>;
  dependencies: typeof DEPENDENCIES;
};

function Slides({ release, cardRef, slidesRef, onClose, onTryIt, dependencies: d }: SlidesProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = d.useMediaQuery("(prefers-reduced-motion: reduce)");
  const { measureRef, width } = d.useElementWidth();
  const slideCount = release.slides.length;
  const slide = release.slides[slideIndex];
  const isFirstSlide = slideIndex === 0;
  const isLastSlide = slideIndex === slideCount - 1;
  const { durationSeconds, posterAt } = SCENES[slide.sceneId];
  const elapsedSeconds = d.useSceneClock(!isPaused && !prefersReducedMotion, String(slideIndex));
  const hasSceneEnded = elapsedSeconds >= durationSeconds;
  const sceneTime = prefersReducedMotion ? posterAt : isLastSlide ? elapsedSeconds % durationSeconds : Math.min(elapsedSeconds, durationSeconds);

  useEffect(
    function advanceOnceTheSceneEnds() {
      if (hasSceneEnded && !isLastSlide && !prefersReducedMotion) setSlideIndex(index => index + 1);
    },
    [hasSceneEnded, isLastSlide, prefersReducedMotion]
  );

  const showPreviousSlide = () => setSlideIndex(index => Math.max(0, index - 1));
  const showNextSlide = () => setSlideIndex(index => Math.min(slideCount - 1, index + 1));

  const browseWithArrowKeys = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") showPreviousSlide();
    else if (event.key === "ArrowRight") showNextSlide();
  };

  const startTour = () => {
    const box = cardRef.current?.getBoundingClientRect();
    onTryIt(box ? { x: box.left, y: box.top, width: box.width, height: box.height } : null);
  };

  const progressOf = (index: number) => {
    if (index !== slideIndex) return index < slideIndex ? 1 : 0;
    return prefersReducedMotion ? 1 : Math.min(1, elapsedSeconds / durationSeconds);
  };

  return (
    <div ref={slidesRef} tabIndex={-1} className="flex flex-col outline-none" onKeyDown={browseWithArrowKeys}>
      <div
        ref={measureRef}
        className="relative aspect-video shrink-0 overflow-hidden bg-background"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {width > 0 && <d.WhatsNewScene sceneId={slide.sceneId} time={sceneTime} width={width} height={(width * 9) / 16} />}
        <div className="absolute inset-x-0 bottom-0 flex h-[3px] gap-[3px]" aria-hidden="true">
          {release.slides.map((each, index) => (
            <span key={each.sceneId} className={styles.segment}>
              <i className={styles.segmentFill} style={{ transform: `scaleX(${progressOf(index)})` }} />
            </span>
          ))}
        </div>
      </div>

      <div className="relative flex min-h-[150px] flex-col gap-2 px-6 pb-1 pt-[22px]">
        <div key={slideIndex} className={cn("flex flex-col gap-2", styles.slideCopy)}>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            <span className="inline-flex h-[18px] items-center rounded-[5px] bg-foreground px-1.5 text-[10px] font-semibold tracking-[0.06em] text-background">
              New
            </span>
            {release.name}
          </div>
          <DialogTitle className="text-balance pr-7 text-[22px] font-semibold leading-[1.2] tracking-[-0.02em]">{slide.title}</DialogTitle>
          <DialogDescription className="text-pretty text-sm leading-[21px] text-muted-foreground">{slide.body}</DialogDescription>
        </div>
        <DialogClose
          aria-label="Close"
          className="absolute right-3.5 top-3.5 inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-[15px] w-[15px]" />
        </DialogClose>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-6 pb-5 pt-4">
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-[9px]"
            aria-label="Previous slide"
            disabled={isFirstSlide}
            onClick={showPreviousSlide}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-[9px]" aria-label="Next slide" disabled={isLastSlide} onClick={showNextSlide}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          <Button variant="ghost" className="h-9 rounded-[9px] px-4 text-muted-foreground max-sm:flex-1" onClick={onClose}>
            Maybe later
          </Button>
          <Button className="h-9 gap-1.5 rounded-[9px] px-4 max-sm:flex-1" onClick={startTour}>
            Try it now
            <ArrowRight className="h-[15px] w-[15px]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
