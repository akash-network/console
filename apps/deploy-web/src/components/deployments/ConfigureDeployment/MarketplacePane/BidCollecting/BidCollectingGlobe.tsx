"use client";
import type { FC } from "react";
import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";

import type { BidGlobeScene, LocatedProvider } from "./bidGlobeScene";
import { advanceBidGlobeScene, BID_SETTLED_SECONDS, buildGlobeField, composeGlobeOverlay, createBidGlobeScene, viewAt } from "./bidGlobeScene";
import { locateViewer } from "./globeGeometry";
import { createBidGlobePainter } from "./paintBidGlobe";
import { useLandShape } from "./useLandShape";

export const DEPENDENCIES = { useLandShape, useReducedMotion };

const GLOBE_SIZE_PX = 280;
const MAX_PIXEL_RATIO = 2;
const LAND_FADE_IN_MS = 400;
const STILL_FRAME_SECONDS = 2.4;
const STILL_FRAME_INTERVAL_MS = 250;

interface Props {
  providers: LocatedProvider[];
  bidderId: string | null;
  /** Shuffles the launch order, so each placement plays its own sequence. */
  seed: string;
  dependencies?: typeof DEPENDENCIES;
}

/** Props are read every frame, so a landing bid never restarts the animation. */
export const BidCollectingGlobe: FC<Props> = ({ providers, bidderId, seed, dependencies: d = DEPENDENCIES }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landShape = d.useLandShape();
  const isStill = !!d.useReducedMotion();
  const field = useMemo(() => buildGlobeField(providers, locateViewer(new Date().getTimezoneOffset()), seed), [providers, seed]);
  const liveRef = useRef({ field, bidderId, landShape, isStill });
  liveRef.current = { field, bidderId, landShape, isStill };

  useEffect(function animateGlobe() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const pixelRatio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1);
    canvas.width = Math.round(GLOBE_SIZE_PX * pixelRatio);
    canvas.height = Math.round(GLOBE_SIZE_PX * pixelRatio);
    const paint = createBidGlobePainter(context);
    const startedAt = performance.now();
    let scene: BidGlobeScene | null = null;
    let bidAt: number | null = null;
    let landShownAt: number | null = null;
    let frameId = 0;
    let stillFrameTimer: ReturnType<typeof setTimeout> | undefined;

    const renderFrame = (now: number) => {
      const live = liveRef.current;
      if (scene?.field.key !== live.field.key) scene = createBidGlobeScene(live.field);
      scene.field = live.field;
      bidAt = live.bidderId === null ? null : (bidAt ?? now);
      landShownAt = live.landShape === null ? null : (landShownAt ?? now);

      const frame = {
        seconds: live.isStill ? STILL_FRAME_SECONDS : (now - startedAt) / 1000,
        bid:
          live.bidderId === null || bidAt === null
            ? null
            : { providerId: live.bidderId, seconds: live.isStill ? BID_SETTLED_SECONDS : (now - bidAt) / 1000 },
        isStill: live.isStill
      };
      advanceBidGlobeScene(scene, frame);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, GLOBE_SIZE_PX, GLOBE_SIZE_PX);
      paint({
        size: GLOBE_SIZE_PX,
        view: viewAt(scene.field, frame.seconds),
        land:
          live.landShape && landShownAt !== null
            ? { shape: live.landShape, opacity: live.isStill ? 1 : Math.min(1, (now - landShownAt) / LAND_FADE_IN_MS) }
            : null,
        shapes: composeGlobeOverlay(scene, frame, GLOBE_SIZE_PX)
      });

      if (live.isStill) stillFrameTimer = setTimeout(() => (frameId = requestAnimationFrame(renderFrame)), STILL_FRAME_INTERVAL_MS);
      else frameId = requestAnimationFrame(renderFrame);
    };

    frameId = requestAnimationFrame(renderFrame);
    return function stopAnimating() {
      cancelAnimationFrame(frameId);
      clearTimeout(stillFrameTimer);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="block aspect-square w-[220px] max-w-full sm:w-[280px]" />;
};
