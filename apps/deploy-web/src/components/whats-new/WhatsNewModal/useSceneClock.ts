"use client";
import { useEffect, useRef, useState } from "react";

/** A slow or backgrounded frame never jumps the scene ahead by more than this. */
const MAX_FRAME_SECONDS = 0.1;

/** Seconds of wall-clock time spent running, restarting from zero whenever `restartKey` changes. */
export function useSceneClock(isRunning: boolean, restartKey: string) {
  const [reading, setReading] = useState({ restartKey, seconds: 0 });
  const elapsedRef = useRef({ restartKey, seconds: 0 });

  useEffect(
    function tickEveryFrameWhileRunning() {
      if (elapsedRef.current.restartKey !== restartKey) elapsedRef.current = { restartKey, seconds: 0 };
      if (!isRunning) return;

      let frame = 0;
      let lastFrameAt = performance.now();
      const tick = (now: number) => {
        const elapsed = elapsedRef.current;
        elapsed.seconds += Math.min(MAX_FRAME_SECONDS, Math.max(0, now - lastFrameAt) / 1000);
        lastFrameAt = now;
        setReading({ restartKey: elapsed.restartKey, seconds: elapsed.seconds });
        frame = requestAnimationFrame(tick);
      };

      frame = requestAnimationFrame(tick);
      return function stopTicking() {
        cancelAnimationFrame(frame);
      };
    },
    [isRunning, restartKey]
  );

  return reading.restartKey === restartKey ? reading.seconds : 0;
}
