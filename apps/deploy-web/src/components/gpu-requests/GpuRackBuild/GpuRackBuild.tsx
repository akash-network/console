import type { FC, ReactNode } from "react";
import { useState } from "react";
import { PencilIcon } from "lucide-react";

import type { QuoteStepId } from "../gpuQuoteDraft/gpuQuoteDraft";
import styles from "./GpuRackBuild.module.css";
import type { RackBuild, RackCallout, RackKind, RackPart } from "./rackBuild";
import type { Box, Point3 } from "./rackGeometry";
import {
  BAY_COLUMNS,
  boxPaths,
  CAGE_HEIGHT,
  calloutEdge,
  faceRect,
  FLOOR,
  FRONT,
  meshPath,
  pathOf,
  placeCallouts,
  project,
  RACK_UNIT,
  round,
  slideFrom,
  VIEW_BOX
} from "./rackGeometry";

type Tone = "hi" | "mid" | "lo" | "faint" | "lit";

type ServerLayout = { heightUnits: number; gpuSlots: [number, number]; seam: number; bay: [number, number]; handle: [number, number]; led: number; storageAnchor: number };

/** Offsets up from a server's base: GPU slots below a seam, drive bays above it, as on an 8U HGX or a 4U PCIe chassis. */
const SERVER_LAYOUTS: Record<Exclude<RackKind, "nvl">, ServerLayout> = {
  "8u": { heightUnits: 8, gpuSlots: [4, 21], seam: 24, bay: [26, 32], handle: [5, 22], led: 30, storageAnchor: 29 },
  "4u": { heightUnits: 4, gpuSlots: [2.2, 10.8], seam: 12, bay: [13, 16.4], handle: [2.6, 12], led: 15, storageAnchor: 14.7 }
};

const FIRST_SLOT_Z = 12.4;

type Tray = { type: "power" | "compute" | "switch"; z: number };

/** A GB300 NVL72 rack: power shelves around 18 compute trays split by 9 NVLink switch trays. */
const NVL_TRAYS: Tray[] = (() => {
  const layout: [Tray["type"], number, number][] = [
    ["power", 2, 1],
    ["compute", 1, 8],
    ["switch", 1, 9],
    ["compute", 1, 10],
    ["power", 2, 1]
  ];
  const trays: Tray[] = [];
  let z = FIRST_SLOT_Z;

  for (const [type, heightUnits, count] of layout) {
    for (let index = 0; index < count; index++) {
      trays.push({ type, z });
      z += heightUnits * RACK_UNIT;
    }
  }

  return trays;
})();

const NVL_STORAGE_ANCHOR = 157.6;
const NVL_GPUS_ANCHOR = 80;
const TRAY_GPU_COLUMNS = [10, 19.5, 29, 38.5];
const NVL_CABLE_PORTS = [60, 76, 92];

const CALLOUT_ANCHORS: Record<RackCallout["part"], (kind: RackKind, servers: number) => Point3> = {
  network: () => [10, FRONT, 185.4],
  storage: (kind, servers) => [10, FRONT, kind === "nvl" ? NVL_STORAGE_ANCHOR : serverZ(kind, Math.max(0, servers - 1)) + SERVER_LAYOUTS[kind].storageAnchor],
  servers: (kind, servers) => [16, FRONT, kind === "nvl" ? NVL_GPUS_ANCHOR : FIRST_SLOT_Z + (servers * serverHeight(kind)) / 2],
  cage: () => [60, FLOOR.y0 + 1, 150],
  power: () => [59.2, 9, 120],
  floor: () => [110, 136, 0]
};

const UPS_X = 74;

type Props = { build: RackBuild; onChangeStep: (step: QuoteStepId) => void };

/** The drawing is decorative and pointer-only; its callouts are the buttons that carry the same summary and way back to each question. */
export const GpuRackBuild: FC<Props> = ({ build, onChangeStep }) => {
  const [hoveredPart, setHoveredPart] = useState<RackPart | null>(null);
  const isLit = (part: RackPart) => build.currentPart === part || hoveredPart === part;
  const placedCallouts = (["left", "right"] as const).flatMap(side =>
    placeCallouts(
      build.callouts.filter(callout => callout.side === side).map(callout => ({ id: callout, at: CALLOUT_ANCHORS[callout.part](build.kind, build.serversInRack) }))
    )
  );

  function partHandlers(part: RackPart) {
    return {
      onClick: () => onChangeStep(build.stepOfPart[part]),
      onMouseEnter: () => setHoveredPart(part),
      onMouseLeave: () => setHoveredPart(current => (current === part ? null : current))
    };
  }

  return (
    <div className={styles.root}>
      <div className={styles.plate}>
        <div className={styles.corners} aria-hidden="true">
          <span className={styles.corner} data-corner="fig">
            Fig 1
          </span>
          <span className={styles.corner} data-corner="title">
            {build.title}
          </span>
          <span className={styles.corner} data-corner="hint">
            Click to change
          </span>
          <span className={styles.corner} data-corner="readout">
            {build.readout}
          </span>
        </div>
        <div className={styles.figure}>
          <svg className={styles.svg} viewBox={`${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}`} aria-hidden="true">
            {build.isBuilt.floor && (
              <ClickablePart partHandlers={partHandlers} part="floor">
                <g className={styles.slideIn} style={slideFrom(0, 0, -40)}>
                  <Floor isLit={isLit("floor")} />
                </g>
              </ClickablePart>
            )}
            {build.isBuilt.cage && (
              <ClickablePart partHandlers={partHandlers} part="cage">
                <g className={styles.slideIn} style={slideFrom(0, 0, -30)}>
                  <Cage isLit={isLit("cage")} />
                </g>
              </ClickablePart>
            )}
            <Rack build={build} isLit={isLit} partHandlers={partHandlers} />
            {build.hasUps && (
              <ClickablePart partHandlers={partHandlers} part="power">
                <g className={styles.slideIn} style={slideFrom(40, 0, 0, 120)}>
                  <Ups isLit={isLit("power")} isOn={build.isPowered} />
                </g>
              </ClickablePart>
            )}
            {placedCallouts.map(({ id: callout, anchorX, anchorY, y }) => (
              <g key={callout.part} className={styles.slideIn} style={slideFrom(0, 0, 0, 160)}>
                <path
                  className={styles.line}
                  data-tone={isLit(callout.part) ? "hi" : "mid"}
                  d={`M${round(calloutEdge(callout.side))} ${round(y)}L${round(anchorX)} ${round(anchorY)}`}
                />
                <circle className={styles.pin} data-hot={isLit(callout.part) || undefined} cx={round(anchorX)} cy={round(anchorY)} r={1.3} />
              </g>
            ))}
          </svg>
          {placedCallouts.map(({ id: callout, y }) => (
            <button
              key={callout.part}
              type="button"
              className={styles.callout}
              data-side={callout.side}
              data-hot={hoveredPart === callout.part || undefined}
              aria-current={build.currentPart === callout.part ? "step" : undefined}
              title={`Change ${callout.label}`}
              aria-label={`Change ${callout.label}: ${callout.value}`}
              style={{ top: `${round(((y - VIEW_BOX.y) / VIEW_BOX.height) * 100)}%` }}
              onFocus={() => setHoveredPart(callout.part)}
              onBlur={() => setHoveredPart(current => (current === callout.part ? null : current))}
              {...partHandlers(callout.part)}
            >
              <span className={styles.calloutLabel}>
                {callout.label}
                <span className={styles.calloutEdit} aria-hidden="true">
                  <PencilIcon className="h-2.5 w-2.5" />
                </span>
              </span>
              <span className={styles.calloutValue}>{callout.value}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

type PartHandlers = (part: RackPart) => { onClick: () => void; onMouseEnter: () => void; onMouseLeave: () => void };

const Rack: FC<{ build: RackBuild; isLit: (part: RackPart) => boolean; partHandlers: PartHandlers }> = ({ build, isLit, partHandlers }) => {
  const { kind, serversInRack, isBuilt, sleds } = build;
  const hasServers = isBuilt.servers && serversInRack > 0;
  const serverZs = kind === "nvl" ? [] : Array.from({ length: serversInRack }, (_, index) => serverZ(kind, index));
  const gpuTone: Tone = build.isReview ? "lit" : isLit("servers") ? "hi" : "mid";

  return (
    <g className={styles.slideIn} style={slideFrom(0, 0, 24)}>
      <path
        className={styles.halo}
        d={pathOf(
          [
            [-3, -3, 0],
            [63, -3, 0],
            [63, 103, 0],
            [-3, 103, 0]
          ],
          true
        )}
      />
      <ClickablePart partHandlers={partHandlers} part="rack">
        <RackBack isLit={isLit("rack")} />
      </ClickablePart>
      {hasServers && (
        <ClickablePart partHandlers={partHandlers} part="servers">
          {kind === "nvl"
            ? NVL_TRAYS.map((tray, index) => (
                <g key={index} className={styles.slideIn} style={slideFrom(0, 70, 0, index * 22)}>
                  <NvlTray tray={tray} isLit={isLit("servers")} gpuTone={gpuTone} isOn={build.isPowered} />
                </g>
              ))
            : serverZs.map((z, index) => (
                <g key={index} className={styles.slideIn} style={slideFrom(0, 70, 0, index * 70)}>
                  <Server z={z} layout={SERVER_LAYOUTS[kind]} isLit={isLit("servers")} gpuTone={gpuTone} isOn={build.isPowered} />
                </g>
              ))}
        </ClickablePart>
      )}
      {hasServers && isBuilt.storage && sleds > 0 && (
        <ClickablePart partHandlers={partHandlers} part="storage">
          {kind === "nvl" ? (
            <g className={styles.slideIn} style={slideFrom(0, 40, 0)}>
              <Solid box={[4, 4, 153.2, 52, 92, 2 * RACK_UNIT]} isLit={isLit("storage")} />
              <Lines tone="faint" d={BAY_COLUMNS.map(column => pathOf(faceRect(column, column + 4.4, 154.6, 160.6, FRONT), true)).join("")} />
              <Sleds bay={[154.6, 160.6]} count={sleds} isLit={false} />
            </g>
          ) : (
            serverZs.map((z, index) => (
              <g key={index} className={styles.slideIn} style={slideFrom(0, 12, 0, 80 + index * 60)}>
                <Sleds bay={bayOf(SERVER_LAYOUTS[kind], z)} count={sleds} isLit={isLit("storage")} />
              </g>
            ))
          )}
        </ClickablePart>
      )}
      {isBuilt.network && (
        <ClickablePart partHandlers={partHandlers} part="network">
          <g className={styles.slideIn} style={slideFrom(0, 0, 30)}>
            <Solid box={[4, 4, 183.2, 52, 92, RACK_UNIT]} isLit={isLit("network")} />
            <Dots
              points={Array.from({ length: 12 }, (_, index): Point3[] => [
                [8 + index * 3.3, FRONT, 184.3],
                [8 + index * 3.3, FRONT, 186.5]
              ]).flat()}
              tone={isLit("network") ? "hi" : "mid"}
              radius={0.42}
            />
          </g>
        </ClickablePart>
      )}
      {isBuilt.power && (
        <ClickablePart partHandlers={partHandlers} part="power">
          {[6, 12].slice(0, build.powerStrips).map((y, index) => (
            <g key={y} className={styles.slideIn} style={slideFrom(0, -40, 0, index * 120)}>
              <Solid box={[56.6, y, 16, 2.4, 3.4, 164]} isLit={isLit("power")} />
              <Dots points={Array.from({ length: 18 }, (_, outlet): Point3 => [59.02, y + 1.7, 22 + outlet * 9])} tone="mid" radius={0.4} />
            </g>
          ))}
        </ClickablePart>
      )}
      <ClickablePart partHandlers={partHandlers} part="rack">
        <RackFront isLit={isLit("rack")} />
      </ClickablePart>
      {isBuilt.network && hasServers && (
        <ClickablePart partHandlers={partHandlers} part="network">
          <Cables ports={kind === "nvl" ? NVL_CABLE_PORTS : serverZs.map(z => z + 8)} isLit={isLit("network")} />
        </ClickablePart>
      )}
    </g>
  );
};

const ClickablePart: FC<{ part: RackPart; partHandlers: PartHandlers; children: ReactNode }> = ({ part, partHandlers, children }) => (
  <g className={styles.part} data-part={part} {...partHandlers(part)}>
    {children}
  </g>
);

const RackBack: FC<{ isLit: boolean }> = ({ isLit }) => (
  <g>
    {[
      [2, 2],
      [53, 2],
      [2, 93],
      [53, 93]
    ].map(([x, y]) => (
      <Solid key={`${x}-${y}`} box={[x, y, 0, 5, 5, 2]} tone="lo" />
    ))}
    <Solid box={[0, 0, 2, 60, 100, 6]} tone="lo" isLit={isLit} />
    <Solid box={[0, 0, 8, 3, 3, 184]} isLit={isLit} />
    <Solid box={[0, 3, 60, 3, 94, 2.4]} isLit={isLit} />
    <Solid box={[0, 3, 130, 3, 94, 2.4]} isLit={isLit} />
  </g>
);

const RackFront: FC<{ isLit: boolean }> = ({ isLit }) => {
  const holes = Array.from({ length: 42 }, (_, index): Point3[] => {
    const z = 10.2 + index * RACK_UNIT;
    return [
      [1.5, 100.02, z],
      [58.5, 100.02, z]
    ];
  }).flat();

  return (
    <g>
      <Solid box={[57, 0, 8, 3, 3, 184]} isLit={isLit} />
      <Solid box={[57, 3, 60, 3, 94, 2.4]} isLit={isLit} />
      <Solid box={[57, 3, 130, 3, 94, 2.4]} isLit={isLit} />
      <Solid box={[0, 97, 8, 3, 3, 184]} isLit={isLit} />
      <Solid box={[57, 97, 8, 3, 3, 184]} isLit={isLit} />
      <Dots points={holes} tone="mid" radius={0.45} />
      <Solid box={[0, 0, 192, 60, 100, 8]} isLit={isLit} />
    </g>
  );
};

const Cables: FC<{ ports: number[]; isLit: boolean }> = ({ ports, isLit }) => {
  const runs = ports.map((portZ, index) => {
    const riserX = 53.8 - index * 0.45;
    const switchX = 47 - index * 2.4;
    const switchZ = 186.4 - index * 0.3;
    return {
      path: pathOf([
        [52.6, FRONT, portZ],
        [52.6, 98.6, portZ],
        [riserX, 98.6, portZ],
        [riserX, 98.6, switchZ],
        [switchX, 98.6, switchZ],
        [switchX, FRONT, switchZ]
      ]),
      ends: [
        [52.6, FRONT, portZ],
        [switchX, FRONT, switchZ]
      ] as Point3[]
    };
  });

  return (
    <g className={styles.slideIn} style={slideFrom(0, 0, 0, 260)}>
      <Lines tone={isLit ? "lit" : "mid"} d={runs.map(run => run.path).join("")} />
      <Dots points={runs.flatMap(run => run.ends)} tone="hi" radius={0.5} />
    </g>
  );
};

const Server: FC<{ z: number; layout: ServerLayout; isLit: boolean; gpuTone: Tone; isOn: boolean }> = ({ z, layout, isLit, gpuTone, isOn }) => {
  const [slotsBottom, slotsTop] = layout.gpuSlots;
  const [bayBottom, bayTop] = layout.bay;
  const [handleBottom, handleHeight] = layout.handle;

  return (
    <g>
      <Solid box={[4, 4, z, 52, 92, layout.heightUnits * RACK_UNIT]} tone="hi" isLit={isLit} />
      <Lines
        tone="lo"
        d={pathOf([
          [4, FRONT, z + layout.seam],
          [56, FRONT, z + layout.seam]
        ])}
      />
      <Lines tone={gpuTone} d={BAY_COLUMNS.map(x => pathOf(faceRect(x, x + 4.4, z + slotsBottom, z + slotsTop, FRONT), true)).join("")} />
      <Lines tone="faint" d={BAY_COLUMNS.map(x => pathOf(faceRect(x, x + 4.4, z + bayBottom, z + bayTop, FRONT), true)).join("")} />
      <Solid box={[4.6, 96, z + handleBottom, 1.4, 1.8, handleHeight]} />
      <Solid box={[54, 96, z + handleBottom, 1.4, 1.8, handleHeight]} />
      <Led at={[52.7, FRONT, z + layout.led]} isOn={isOn} />
    </g>
  );
};

const NvlTray: FC<{ tray: Tray; isLit: boolean; gpuTone: Tone; isOn: boolean }> = ({ tray: { type, z }, isLit, gpuTone, isOn }) => {
  if (type === "power") {
    return (
      <g>
        <Solid box={[4, 4, z, 52, 92, 2 * RACK_UNIT]} />
        <Lines
          tone="faint"
          d={[2.2, 4.4, 6.6]
            .map(offset =>
              pathOf([
                [4, FRONT, z + offset],
                [56, FRONT, z + offset]
              ])
            )
            .join("")}
        />
      </g>
    );
  }

  if (type === "switch") {
    return (
      <g>
        <Solid box={[4, 4, z, 52, 92, RACK_UNIT]} />
        <Dots points={Array.from({ length: 12 }, (_, port): Point3 => [9 + port * 3.6, FRONT, z + 2.2])} tone="mid" radius={0.4} />
      </g>
    );
  }

  return (
    <g>
      <Solid box={[4, 4, z, 52, 92, RACK_UNIT]} tone="hi" isLit={isLit} />
      <Lines tone={gpuTone} d={TRAY_GPU_COLUMNS.map(x => pathOf(faceRect(x, x + 7, z + 1.1, z + 3.3, FRONT), true)).join("")} />
      <Led at={[52.7, FRONT, z + 2.2]} isOn={isOn} />
    </g>
  );
};

const Sleds: FC<{ bay: [number, number]; count: number; isLit: boolean }> = ({ bay: [bottom, top], count, isLit }) => {
  const columns = BAY_COLUMNS.slice(0, count);

  return (
    <g>
      <Lines tone={isLit ? "lit" : "mid"} d={columns.map(x => pathOf(faceRect(x + 0.6, x + 3.8, bottom + 0.6, top - 0.6, FRONT + 0.4), true)).join("")} />
      <Dots points={columns.map((x): Point3 => [x + 3.1, FRONT + 0.4, bottom + 1.4])} tone="hi" radius={0.42} />
    </g>
  );
};

const Floor: FC<{ isLit: boolean }> = ({ isLit }) => {
  const { x0, x1, y0, y1 } = FLOOR;
  let grid = "";
  for (let x = x0 + 30; x < x1; x += 30) {
    grid += pathOf([
      [x, y0, 0],
      [x, y1, 0]
    ]);
  }
  for (let y = y0 + 30; y < y1; y += 30) {
    grid += pathOf([
      [x0, y, 0],
      [x1, y, 0]
    ]);
  }
  const perforations = [0, 1].flatMap(tile =>
    Array.from({ length: 16 }, (_, hole): Point3 => [tile * 30 + 4.5 + Math.floor(hole / 4) * 7, 130.5 + (hole % 4) * 7, 0])
  );

  return (
    <g>
      <Solid box={[x0, y0, -6, x1 - x0, y1 - y0, 6]} tone="lo" front={1} isLit={isLit} />
      <Lines tone="faint" d={grid} />
      <Dots points={perforations} tone="lo" radius={0.55} />
    </g>
  );
};

const Cage: FC<{ isLit: boolean }> = ({ isLit }) => {
  const { x0, x1, y0, y1 } = FLOOR;
  const height = CAGE_HEIGHT;
  const mesh =
    meshPath({ wall: "y", at: y0 + 1, from: x0 + 2, to: x1 - 2, bottom: 3, top: height - 4, step: 12 }) +
    meshPath({ wall: "x", at: x0 + 1, from: y0 + 2, to: y1 - 2.6, bottom: 3, top: height - 4, step: 12 });

  return (
    <g>
      <Lines tone="faint" d={mesh} />
      <Solid box={[x0, y0, 0, x1 - x0, 2, 3]} tone="lo" isLit={isLit} />
      <Solid box={[x0, y0, height - 4, x1 - x0, 2, 4]} tone="lo" isLit={isLit} />
      {[x0, x0 + 56, x0 + 112, x1 - 2].map(x => (
        <Solid key={x} box={[x, y0, 0, 2, 2, height]} tone="lo" isLit={isLit} />
      ))}
      <Solid box={[x0, y0 + 2, 0, 2, y1 - y0 - 4.6, 3]} tone="lo" isLit={isLit} />
      <Solid box={[x0, y0 + 2, height - 4, 2, y1 - y0 - 4.6, 4]} tone="lo" isLit={isLit} />
      {[y0 + 60, y0 + 120].map(y => (
        <Solid key={y} box={[x0, y, 0, 2, 2, height]} tone="lo" isLit={isLit} />
      ))}
      <Solid box={[x0, y1 - 2.6, 0, 2.6, 2.6, height]} isLit={isLit} />
      <Solid box={[x0 - 0.2, y1 + 0.2, 100, 3, 1.4, 4.6]} tone="hi" isLit={isLit} />
      <Lines
        tone={isLit ? "lit" : "hi"}
        d={pathOf([
          [x0 + 0.5, y1 + 0.9, 104.6],
          [x0 + 0.5, y1 + 0.9, 107],
          [x0 + 2.1, y1 + 0.9, 107],
          [x0 + 2.1, y1 + 0.9, 104.6]
        ])}
      />
    </g>
  );
};

const Ups: FC<{ isLit: boolean; isOn: boolean }> = ({ isLit, isOn }) => (
  <g>
    <path
      className={styles.halo}
      d={pathOf(
        [
          [UPS_X - 3, 5, 0],
          [UPS_X + 37, 5, 0],
          [UPS_X + 37, 99, 0],
          [UPS_X - 3, 99, 0]
        ],
        true
      )}
    />
    <Solid box={[UPS_X, 8, 0, 34, 88, 176]} isLit={isLit} />
    <Lines
      tone="faint"
      d={[24, 48, 72, 96, 120]
        .map(
          z =>
            pathOf([
              [UPS_X, FRONT, z],
              [UPS_X + 34, FRONT, z]
            ]) +
            pathOf([
              [UPS_X + 34.02, 8, z],
              [UPS_X + 34.02, 96, z]
            ])
        )
        .join("")}
    />
    <Lines tone="mid" d={pathOf(faceRect(UPS_X + 5, UPS_X + 17, 150, 160, FRONT), true)} />
    <Led at={[UPS_X + 27, FRONT, 155]} isOn={isOn} />
  </g>
);

/** A solid in the kit's style: paper fill, two side tones, a lighter top and one outline. */
const Solid: FC<{ box: Box; tone?: Tone; isLit?: boolean; front?: number; side?: number }> = ({ box, tone = "mid", isLit = false, front = 2, side = 0 }) => {
  const paths = boxPaths(box);

  return (
    <g className={styles.solid} data-lit={isLit || undefined}>
      <path className={styles.fill} d={paths.outline} />
      <path className={styles.shade} data-shade={side} d={paths.side} />
      <path className={styles.shade} data-shade={front} d={paths.front} />
      <path className={styles.top} d={paths.top} />
      <path className={styles.line} data-edge="" data-tone={tone} d={paths.edges} />
    </g>
  );
};

const Lines: FC<{ d: string; tone: Tone }> = ({ d, tone }) => <path className={styles.line} data-tone={tone} d={d} />;

const Dots: FC<{ points: Point3[]; tone: Tone; radius: number }> = ({ points, tone, radius }) => (
  <g className={styles.dots} data-tone={tone}>
    {points.map((point, index) => {
      const [x, y] = project(point);
      return <circle key={index} cx={round(x)} cy={round(y)} r={radius} />;
    })}
  </g>
);

const Led: FC<{ at: Point3; isOn: boolean }> = ({ at, isOn }) => {
  const [x, y] = project(at);
  return <circle className={styles.led} data-on={isOn || undefined} cx={round(x)} cy={round(y)} r={0.75} />;
};

function serverHeight(kind: RackKind): number {
  return kind === "4u" ? 4 * RACK_UNIT : 8 * RACK_UNIT;
}

function serverZ(kind: RackKind, index: number): number {
  return FIRST_SLOT_Z + index * serverHeight(kind);
}

function bayOf(layout: ServerLayout, z: number): [number, number] {
  return [z + layout.bay[0], z + layout.bay[1]];
}
