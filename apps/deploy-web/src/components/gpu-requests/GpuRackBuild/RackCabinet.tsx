import type { FC } from "react";

import type { RackSlot, RackSpan } from "./rackBuild";
import type { Plan, Point3 } from "./rackGeometry";
import {
  boxOf,
  CHASSIS,
  faceRect,
  FRONT,
  insetPlan,
  pathOf,
  planCorners,
  RACK,
  RACK_DOOR,
  RACK_UNIT,
  RACK_UNITS,
  RAILS_BOTTOM,
  RAILS_TOP,
  ringPath,
  ROOF_TOP,
  roundedTopRect,
  seamPath,
  sideRect
} from "./rackGeometry";
import { closedPath, Cylinder, Dots, Halo, Leds, Lines, range, Solid, Wire } from "./rackShapes";

const RAILS_HEIGHT = RAILS_TOP - RAILS_BOTTOM;

const CHASSIS_SIDE = CHASSIS.x + CHASSIS.width;

/** The top-of-rack switch is shallower than a server. */
const SWITCH: Plan = { x: 64, y: 62, width: 46, depth: 51 };

const SWITCH_BOTTOM = RAILS_TOP - RACK_UNIT + 0.2;

const SWITCH_HEIGHT = RACK_UNIT - 0.4;

const SWITCH_PORT_SPACING = 2.3;

/** Cables run in front of the panels, and land on the switch's lower ports 9 to 16 to stay clear of the servers' LEDs. */
const CABLE_DEPTH = FRONT + 0.8;
const FIRST_CABLED_PORT = 8;
const MAX_CABLES = 8;

/** Cage-nut hole centres within each rack unit, at the EIA-310 spacing. */
const EIA_HOLE_OFFSETS = [0.635, 2.2225, 3.81];

const PLINTH_LABEL_LINES: [z: number, endX: number][] = [
  [9.3, 82],
  [8, 82],
  [6.7, 76]
];

const FAN_CENTERS: [number, number][] = [
  [76, 34],
  [104, 34]
];

function unitZ(unit: number): number {
  return RAILS_BOTTOM + unit * RACK_UNIT;
}

function isGpuSlot(slot: RackSlot): boolean {
  return slot.type === "server" || slot.type === "compute";
}

/** The cabinet's parts that sit behind its contents: casters, plinth, rear posts, the perforated rear door and the closed side panel. */
export const RackBack: FC<{ isLit: boolean }> = ({ isLit }) => {
  const doorMesh: Point3[] = [];
  for (let z = RAILS_BOTTOM + 6; z < RAILS_TOP - 4; z += 4.6) {
    for (let x = 67; x < 115; x += 4.6) doorMesh.push([x, 11.6, z]);
  }
  const sidePanel: Plan = { x: 60, y: 13, width: 1.6, depth: 101 };

  return (
    <g>
      <Halo plan={insetPlan(RACK, -1.5)} />
      {planCorners(RACK, 6).map(center => (
        <Cylinder key={center.join()} center={center} radius={2.4} z={0} height={4} />
      ))}
      <Solid box={boxOf(RACK, 4, 8)} tone="mid" isLit={isLit}>
        <Lines tone="mid" d={closedPath(faceRect(66, 84, 5.4, 10.6, RACK_DOOR))} />
        <Lines
          tone="lo"
          d={PLINTH_LABEL_LINES.map(([z, endX]) =>
            pathOf([
              [68, RACK_DOOR, z],
              [endX, RACK_DOOR, z]
            ])
          ).join("")}
        />
        <Dots
          tone="mid"
          radius={0.42}
          points={[
            [66.9, RACK_DOOR, 6.2],
            [83.1, RACK_DOOR, 6.2],
            [66.9, RACK_DOOR, 9.8],
            [83.1, RACK_DOOR, 9.8]
          ]}
        />
        <Lines
          tone="faint"
          d={range(8)
            .map(vent => closedPath(faceRect(88 + vent * 3.6, 89.6 + vent * 3.6, 6, 10, RACK_DOOR)))
            .join("")}
        />
      </Solid>
      <Solid box={[60, 10, RAILS_BOTTOM, 3, 3, RAILS_HEIGHT]} tone="mid" isLit={isLit} />
      <Solid box={[63, 10, RAILS_BOTTOM, 54, 1.6, RAILS_HEIGHT]} tone="lo" isLit={isLit}>
        <Dots tone="faint" radius={0.32} points={doorMesh} />
      </Solid>
      <Solid box={boxOf(sidePanel, RAILS_BOTTOM, RAILS_HEIGHT)} tone="lo" isLit={isLit}>
        <Lines tone="faint" d={seamPath(sidePanel, RAILS_BOTTOM + RAILS_HEIGHT / 2)} />
      </Solid>
      <Solid box={[117, 10, RAILS_BOTTOM, 3, 3, RAILS_HEIGHT]} tone="mid" isLit={isLit}>
        <Dots tone="faint" radius={0.3} points={range(RACK_UNITS).map((unit): Point3 => [118.5, 13, unitZ(unit + 0.5)])} />
      </Solid>
    </g>
  );
};

/** The cabinet's parts that sit in front of its contents: the open side's frame rails, the front rails with their cage-nut holes and unit ruler, and the roof. */
export const RackFront: FC<{ isLit: boolean; isOn: boolean }> = ({ isLit, isOn }) => {
  const cageNutHoles = (x: number) =>
    range(RACK_UNITS)
      .flatMap(unit => EIA_HOLE_OFFSETS.map(offset => unitZ(unit) + offset))
      .map(z => closedPath(faceRect(x, x + 0.75, z - 0.375, z + 0.375, RACK_DOOR)))
      .join("");
  const rulerTicks = (isMajor: boolean) =>
    range(RACK_UNITS + 1)
      .filter(unit => (unit % 5 === 0) === isMajor)
      .map(unit =>
        pathOf([
          [60, RACK_DOOR, unitZ(unit)],
          [isMajor ? 61.9 : 61.2, RACK_DOOR, unitZ(unit)]
        ])
      )
      .join("");
  const cableSlot: Plan = { x: 70, y: 66, width: 40, depth: 9 };

  return (
    <g>
      {[RAILS_BOTTOM, RAILS_TOP - 3.4].map(z => (
        <Solid key={z} box={[117, 13, z, 3, 101, 3.4]} tone="mid" isLit={isLit} />
      ))}
      <Solid box={[60, 114, RAILS_BOTTOM, 3.6, 3, RAILS_HEIGHT]} tone="mid" isLit={isLit}>
        <Lines tone="lo" d={rulerTicks(false)} />
        <Lines tone="mid" d={rulerTicks(true)} />
        <Lines tone="lo" d={cageNutHoles(62.4)} />
      </Solid>
      <Solid box={[116.4, 114, RAILS_BOTTOM, 3.6, 3, RAILS_HEIGHT]} tone="mid" isLit={isLit}>
        <Lines tone="lo" d={cageNutHoles(117.1)} />
      </Solid>
      <Solid box={boxOf(RACK, RAILS_TOP, ROOF_TOP - RAILS_TOP)} tone="mid" isLit={isLit}>
        <Lines tone="lo" d={FAN_CENTERS.flatMap(center => [8.5, 6, 3.5].map(radius => ringPath(center, radius, ROOF_TOP))).join("")} />
        <Dots tone="mid" radius={0.5} points={FAN_CENTERS.map(([x, y]): Point3 => [x, y, ROOF_TOP])} />
        <Lines tone="mid" d={closedPath(roundedTopRect(cableSlot, 4, ROOF_TOP))} />
        <Lines
          tone="faint"
          d={range(15)
            .map(bristle =>
              pathOf([
                [74.6 + bristle * 2.2, 66, ROOF_TOP],
                [74.6 + bristle * 2.2, 75, ROOF_TOP]
              ])
            )
            .join("")}
        />
        <Dots tone="mid" radius={0.48} points={planCorners(RACK, 3).map(([x, y]): Point3 => [x, y, ROOF_TOP])} />
        <Lines
          tone="lo"
          d={range(12)
            .map(vent => closedPath(faceRect(70 + vent * 2.6, 71.2 + vent * 2.6, RAILS_TOP + 1.6, ROOF_TOP - 1.6, RACK_DOOR)))
            .join("")}
        />
      </Solid>
      <Leds points={[[110, RACK_DOOR, (RAILS_TOP + ROOF_TOP) / 2]]} isOn={isOn} />
    </g>
  );
};

/** Everything on the rails, plus a blanking panel over every unit left empty. */
export const RackContents: FC<{ slots: RackSlot[]; blankSpans: RackSpan[]; isLit: boolean; isOn: boolean }> = ({ slots, blankSpans, isLit, isOn }) => (
  <g>
    {slots.map(slot => {
      const Chassis = CHASSIS_OF_SLOT[slot.type];
      return <Chassis key={slot.bottomUnit} bottom={unitZ(slot.bottomUnit)} height={slot.units * RACK_UNIT} isLit={isLit} isOn={isOn} />;
    })}
    {blankSpans.map(span => (
      <BlankingPanels key={span.bottomUnit} span={span} />
    ))}
  </g>
);

type ChassisProps = { bottom: number; height: number; isLit: boolean; isOn: boolean };

/** An 8U HGX or a 4U PCIe server: a vented GPU bay above a seam, drive bays below it, grab handles on the ears and vent slots down the open side. */
const Server: FC<ChassisProps> = ({ bottom, height, isLit, isOn }) => {
  const top = bottom + height - 0.2;
  const seam = bottom + height * 0.36;
  const middle = bottom + height / 2;
  const handleHeight = Math.min(12, height * 0.6);
  const vents: Point3[] = [];
  for (let z = top - 2; z > seam + 1.6; z -= 2.2) {
    for (let x = 68.5; x < 102; x += 2.6) vents.push([x, FRONT, z]);
  }

  return (
    <g>
      <Solid box={boxOf(CHASSIS, bottom + 0.2, height - 0.4)} tone="hi" isLit={isLit}>
        <Lines tone="lo" d={seamPath(CHASSIS, seam)} />
        <Dots tone="lo" radius={0.34} points={vents} />
        <Lines
          tone="faint"
          d={range(7)
            .map(slot => closedPath(sideRect(30 + slot * 5, 32.4 + slot * 5, seam + 1.6, top - 1.6, CHASSIS_SIDE)))
            .join("")}
        />
      </Solid>
      {[65, 107.6].map(x => (
        <Solid key={x} box={[x, FRONT, middle - handleHeight / 2, 1.4, 1.6, handleHeight]} tone="mid" />
      ))}
      <Leds
        points={[
          [104.4, FRONT, top - 1.8],
          [106.2, FRONT, top - 1.8]
        ]}
        isOn={isOn}
      />
    </g>
  );
};

/** An NVL72 compute tray carries four GPUs. */
const ComputeTray: FC<ChassisProps> = ({ bottom, height, isLit, isOn }) => {
  const [trayBottom, trayHeight] = [bottom + 0.15, height - 0.3];

  return (
    <g>
      <Solid box={boxOf(CHASSIS, trayBottom, trayHeight)} tone="hi" isLit={isLit}>
        <Lines
          tone="lo"
          d={range(4)
            .map(gpu => closedPath(faceRect(80 + gpu * 5.4, 84.4 + gpu * 5.4, trayBottom + 0.8, trayBottom + trayHeight - 0.8, FRONT)))
            .join("")}
        />
      </Solid>
      <Leds points={[[106.4, FRONT, trayBottom + trayHeight / 2]]} isOn={isOn} />
    </g>
  );
};

const SwitchTray: FC<ChassisProps> = ({ bottom, height }) => (
  <Solid box={boxOf(CHASSIS, bottom + 0.15, height - 0.3)} tone="mid">
    <Dots tone="mid" radius={0.36} points={range(18).map((port): Point3 => [67 + port * 2.2, FRONT, bottom + height / 2])} />
  </Solid>
);

const PowerShelf: FC<ChassisProps> = ({ bottom, height }) => (
  <Solid box={boxOf(CHASSIS, bottom + 0.15, height - 0.3)} tone="lo">
    <Lines
      tone="faint"
      d={range(6)
        .map(supply => closedPath(faceRect(66 + supply * 7.2, 72 + supply * 7.2, bottom + 1.15, bottom + height - 1.15, FRONT)))
        .join("")}
    />
  </Solid>
);

const CHASSIS_OF_SLOT: Record<RackSlot["type"], FC<ChassisProps>> = { server: Server, compute: ComputeTray, switch: SwitchTray, power: PowerShelf };

/** One 1U plate per empty unit, screwed to the rails at both ears. */
const BlankingPanels: FC<{ span: RackSpan }> = ({ span: { bottomUnit, units } }) => {
  const panelFace = FRONT + 0.6;

  return (
    <Solid box={[64, FRONT - 0.6, unitZ(bottomUnit) + 0.15, 46, 1.2, units * RACK_UNIT - 0.3]} tone="mid">
      <Lines
        tone="lo"
        d={range(units - 1)
          .map(panel =>
            pathOf([
              [64, panelFace, unitZ(bottomUnit + panel + 1)],
              [110, panelFace, unitZ(bottomUnit + panel + 1)]
            ])
          )
          .join("")}
      />
      <Dots
        tone="mid"
        radius={0.36}
        points={range(units).flatMap((panel): Point3[] => [
          [65.2, panelFace, unitZ(bottomUnit + panel + 0.5)],
          [108.8, panelFace, unitZ(bottomUnit + panel + 0.5)]
        ])}
      />
    </Solid>
  );
};

/** The request's NVMe drives, seated in each server's band under the seam or across a compute tray, where only three fit. */
export const DriveBays: FC<{ slots: RackSlot[]; drives: number; isLit: boolean }> = ({ slots, drives, isLit }) => (
  <g>
    {slots.filter(isGpuSlot).map(slot => {
      const [bottom, height] = [unitZ(slot.bottomUnit), slot.units * RACK_UNIT];
      const [bayBottom, bayTop, bays] =
        slot.type === "compute" ? [bottom + 0.9, bottom + height - 0.9, Math.min(3, drives)] : [bottom + 1.4, bottom + height * 0.36 - 1.2, drives];
      const bayXs = range(bays).map(bay => 67.6 + bay * 4.4);

      return (
        <g key={slot.bottomUnit}>
          <Lines tone={isLit ? "lit" : "mid"} d={bayXs.map(x => closedPath(faceRect(x, x + 3.6, bayBottom, bayTop, FRONT))).join("")} />
          <Lines
            tone="lo"
            d={bayXs
              .map(x =>
                pathOf([
                  [x, FRONT, bayBottom + 1.4],
                  [x + 3.6, FRONT, bayBottom + 1.4]
                ])
              )
              .join("")}
          />
          <Dots tone={isLit ? "hi" : "mid"} radius={0.32} points={bayXs.map((x): Point3 => [x + 1.8, FRONT, bayTop - 0.9])} />
        </g>
      );
    })}
  </g>
);

/** The top-of-rack switch, with one cable down to each server; an NVL72's trays share eight cables between them. */
export const RackNetwork: FC<{ slots: RackSlot[]; isLit: boolean }> = ({ slots, isLit }) => {
  const gpuSlots = slots.filter(isGpuSlot);
  const cableEvery = Math.ceil(gpuSlots.length / MAX_CABLES);
  const cabledSlots = gpuSlots.filter((_, index) => index % cableEvery === 0);
  const portZ = (row: number) => SWITCH_BOTTOM + SWITCH_HEIGHT * row;

  return (
    <g>
      <Solid box={boxOf(SWITCH, SWITCH_BOTTOM, SWITCH_HEIGHT)} tone="mid" isLit={isLit}>
        <Dots
          tone="mid"
          radius={0.42}
          points={range(16).flatMap((port): Point3[] => [
            [67 + port * SWITCH_PORT_SPACING, FRONT, portZ(0.7)],
            [67 + port * SWITCH_PORT_SPACING, FRONT, portZ(0.3)]
          ])}
        />
        <Lines
          tone="mid"
          d={[103, 106.2].map(x => closedPath(faceRect(x, x + 2.4, SWITCH_BOTTOM + 0.9, SWITCH_BOTTOM + SWITCH_HEIGHT - 0.9, FRONT))).join("")}
        />
      </Solid>
      {cabledSlots.map((slot, index) => {
        const x = 67 + (FIRST_CABLED_PORT + index) * SWITCH_PORT_SPACING;
        const slotTop = unitZ(slot.bottomUnit + slot.units);
        return (
          <Wire
            key={slot.bottomUnit}
            from={[x, CABLE_DEPTH, portZ(0.3)]}
            to={[x, CABLE_DEPTH, slotTop - (slot.type === "compute" ? 1.2 : 2.2)]}
            tone={isLit ? "lit" : "mid"}
          />
        );
      })}
    </g>
  );
};

/** Zero-U power strips in the open side's channel, each with 20 outlets, a display and a cord down to the plinth. */
export const PowerStrips: FC<{ count: number; isLit: boolean; isOn: boolean }> = ({ count, isLit, isOn }) => (
  <g>
    {range(count).map(strip => {
      const [x, y] = [111.4, 15 + strip * 7.5];
      const [face, middle] = [x + 3, y + 2.5];

      return (
        <g key={strip}>
          <Lines
            tone="mid"
            d={pathOf([
              [x + 1.5, middle, 22],
              [x + 1.5, middle, RAILS_BOTTOM]
            ])}
          />
          <Solid box={[x, y, 22, 3, 5, 168]} tone="mid" isLit={isLit}>
            <Dots tone="lo" radius={0.42} points={range(20).map((outlet): Point3 => [face, middle, 30 + outlet * 7.6])} />
            <Lines tone="mid" d={closedPath(sideRect(y + 1, y + 4, 176, 184, face))} />
          </Solid>
          <Leds points={[[face, middle, 180]]} isOn={isOn} />
        </g>
      );
    })}
  </g>
);
