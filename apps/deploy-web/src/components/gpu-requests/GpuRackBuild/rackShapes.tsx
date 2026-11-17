import type { FC, ReactNode } from "react";

import styles from "./GpuRackBuild.module.css";
import type { Box, Plan, Point2, Point3 } from "./rackGeometry";
import { boxPaths, cylinderPaths, pathOf, project, round, sideTextMatrix, topRect } from "./rackGeometry";

export type LineTone = "hi" | "mid" | "lo" | "faint" | "lit";

export type DotTone = "hi" | "mid" | "lo" | "faint";

export function range(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

export function closedPath(points: Point3[]): string {
  return pathOf(points, true);
}

/** A solid in the kit's style: paper fill, two side tones, a lighter top, its detail, then one outline over it all. */
export const Solid: FC<{ box: Box; tone: LineTone; isLit?: boolean; children?: ReactNode }> = ({ box, tone, isLit = false, children }) => {
  const paths = boxPaths(box);

  return (
    <g className={styles.solid} data-lit={isLit || undefined}>
      <path className={styles.fill} d={paths.outline} />
      <path className={styles.shade} data-shade="0" d={paths.side} />
      <path className={styles.shade} data-shade="3" d={paths.front} />
      <path className={styles.top} d={paths.top} />
      <path className={styles.line} data-tone="faint" d={paths.crease} />
      {children}
      <path className={styles.line} data-edge="" data-tone={tone} d={paths.outline} />
    </g>
  );
};

export const Cylinder: FC<{ center: Point2; radius: number; z: number; height: number }> = ({ center, radius, z, height }) => {
  const paths = cylinderPaths(center, radius, z, height);

  return (
    <g className={styles.solid}>
      <path className={styles.shade} data-shade="1" d={paths.body} />
      <path className={styles.top} d={paths.top} />
      <path className={styles.line} data-edge="" data-tone="lo" d={paths.body + paths.top} />
    </g>
  );
};

export const Lines: FC<{ d: string; tone: LineTone }> = ({ d, tone }) => <path className={styles.line} data-tone={tone} d={d} />;

export const Dots: FC<{ points: Point3[]; tone: DotTone; radius: number }> = ({ points, tone, radius }) => (
  <g className={styles.dots} data-tone={tone}>
    {points.map((point, index) => {
      const [x, y] = project(point);
      return <circle key={index} cx={round(x)} cy={round(y)} r={radius} />;
    })}
  </g>
);

export const Leds: FC<{ points: Point3[]; isOn: boolean }> = ({ points, isOn }) => (
  <>
    {points.map((point, index) => {
      const [x, y] = project(point);
      return <circle key={index} className={styles.led} data-on={isOn || undefined} cx={round(x)} cy={round(y)} r={0.55} />;
    })}
  </>
);

/** A soft shadow under whatever stands on the plan. */
export const Halo: FC<{ plan: Plan }> = ({ plan }) => <path className={styles.halo} d={closedPath(topRect(plan, 0))} />;

export const Wire: FC<{ from: Point3; to: Point3; tone: LineTone }> = ({ from, to, tone }) => (
  <g className={styles.wire} data-tone={tone}>
    <Lines tone={tone} d={pathOf([from, to])} />
    {[from, to].map((end, index) => {
      const [x, y] = project(end);
      return <circle key={index} className={styles.wireEnd} cx={round(x)} cy={round(y)} r={0.5} />;
    })}
  </g>
);

export const SideText: FC<{ at: Point3; tone: "hi" | "mid"; size: number; children: string }> = ({ at, tone, size, children }) => (
  <text className={styles.faceText} data-tone={tone} transform={sideTextMatrix(at)} fontSize={size}>
    {children}
  </text>
);
