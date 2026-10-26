"use client";

import { clamp, SCENE_HEIGHT, SCENE_WIDTH } from "./sceneMath";
import type { SceneId } from "./scenes";
import { SCENES } from "./scenes";
import styles from "./WhatsNewScene.module.css";

type Props = { sceneId: SceneId; time: number; width: number; height: number };

/** One illustrated scene scaled to fit the given box; it is decorative, so assistive tech reads the slide copy instead. */
export function WhatsNewScene({ sceneId, time, width, height }: Props) {
  const { Scene, durationSeconds } = SCENES[sceneId];
  const scale = Math.min(width / SCENE_WIDTH, height / SCENE_HEIGHT);

  return (
    <div className={styles.scene} style={{ width, height }} aria-hidden="true">
      <div
        style={{
          position: "absolute",
          left: (width - SCENE_WIDTH * scale) / 2,
          top: (height - SCENE_HEIGHT * scale) / 2,
          width: SCENE_WIDTH,
          height: SCENE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "0 0"
        }}
      >
        <Scene time={clamp(time, 0, durationSeconds)} />
      </div>
    </div>
  );
}
