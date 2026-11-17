import type { FC } from "react";

import type { RackCalendar } from "./rackBuild";
import type { Plan, Point2, Point3 } from "./rackGeometry";
import { boxOf, CALENDAR, faceRect, FLOOR, FLOOR_PEDESTAL_BOTTOM, insetPlan, pathOf, seamPath, sideRect, topRect, UPS, UPS_HEIGHT } from "./rackGeometry";
import { closedPath, Cylinder, Dots, Halo, Leds, Lines, range, SideText, Solid } from "./rackShapes";

/** Only the pedestals under the two edges the camera sees, far ones first. */
const FLOOR_PEDESTALS: Point2[] = [
  [178, 2],
  [2, 178],
  [178, 60],
  [60, 178],
  [178, 120],
  [120, 178],
  [178, 178]
];

/** The perforated tile sits in the cold aisle in front of the rack. */
const PERFORATED_TILE: Plan = { x: 63, y: 123, width: 54, depth: 54 };

const TILE_EDGES = [60, 120];

const CALENDAR_COLUMNS = 7;
const CALENDAR_ROWS = 5;
const BOARD_THICKNESS = 1.4;
const PAGE_THICKNESS = 0.6;
const CALENDAR_RINGS = 6;
const RING_CURVE_STEPS = 10;

/** A raised floor of 60 cm tiles on pedestals. */
export const RaisedFloor: FC<{ isLit: boolean }> = ({ isLit }) => (
  <g>
    {FLOOR_PEDESTALS.map(center => (
      <Cylinder key={center.join()} center={center} radius={1.7} z={FLOOR_PEDESTAL_BOTTOM} height={10} />
    ))}
    <Solid box={boxOf(FLOOR, -6, 6)} tone="lo" isLit={isLit}>
      <Lines tone="faint" d={seamPath(FLOOR, -2.4)} />
      <Lines
        tone="faint"
        d={TILE_EDGES.map(
          edge =>
            pathOf([
              [edge, 0, 0],
              [edge, FLOOR.depth, 0]
            ]) +
            pathOf([
              [0, edge, 0],
              [FLOOR.width, edge, 0]
            ])
        ).join("")}
      />
      <Lines tone="lo" d={closedPath(topRect(PERFORATED_TILE, 0))} />
      <Dots tone="lo" radius={0.36} points={range(144).map((hole): Point3 => [67 + (hole % 12) * 4.18, 127 + Math.floor(hole / 12) * 4.18, 0])} />
    </Solid>
  </g>
);

/** A UPS cabinet beside the rack, which only the highest uptime asks for. */
export const Ups: FC<{ isLit: boolean; isOn: boolean }> = ({ isLit, isOn }) => {
  const [front, side] = [UPS.y + UPS.depth, UPS.x + UPS.width];

  return (
    <g>
      <Halo plan={insetPlan(UPS, -1.5)} />
      <Solid box={boxOf(UPS, 0, UPS_HEIGHT)} tone="mid" isLit={isLit}>
        <Lines tone="faint" d={seamPath(UPS, 42)} />
        <Lines
          tone="lo"
          d={range(8)
            .map(slot => closedPath(faceRect(131.5 + slot * 3.2, 133 + slot * 3.2, 8, 36, front)))
            .join("")}
        />
        <Lines
          tone="faint"
          d={range(6)
            .map(slot => closedPath(sideRect(70 + slot * 5, 72 + slot * 5, 10, 34, side)))
            .join("")}
        />
        <Lines tone="mid" d={closedPath(faceRect(131.5, 145, 47, 56, front))} />
      </Solid>
      <Leds points={[148, 150.4, 152.8].map((x): Point3 => [x, front, 51.5])} isOn={isOn} />
    </g>
  );
};

/** A ring-bound wall calendar hung from a nail: one page per month of the term, the term on its header and the start day marked on its front page. */
export const WallCalendar: FC<{ calendar: RackCalendar; isLit: boolean }> = ({ calendar: { months, header, startCell }, isLit }) => {
  const { y0, y1, z0, z1 } = CALENDAR;
  const pagesTop = z1 - 6;
  const pagesBottom = z0 + 2;
  const [pagesLeft, pagesRight] = [y0 + 1.5, y1 - 1.5];
  const pagesBehindFront = months - 1;
  const stackDepth = pagesBehindFront * (months > 12 ? 0.5 : 0.8);
  const frontPage: Plan = { x: BOARD_THICKNESS + stackDepth, y: pagesLeft, width: PAGE_THICKNESS, depth: pagesRight - pagesLeft };
  const face = frontPage.x + PAGE_THICKNESS;
  const grid = { left: pagesLeft + 2.5, right: pagesRight - 2.5, bottom: pagesBottom + 3.5, top: pagesTop - 11 };
  const cellWidth = (grid.right - grid.left) / CALENDAR_COLUMNS;
  const cellHeight = (grid.top - grid.bottom) / CALENDAR_ROWS;
  const middle = (y0 + y1) / 2;
  const nail: Point3 = [0.7, middle, z1 + 7];
  const ringYs = range(CALENDAR_RINGS).map(ring => grid.left + 1.5 + (ring * (grid.right - grid.left - 3)) / (CALENDAR_RINGS - 1));

  return (
    <g>
      <Solid box={[0, y0, z0, BOARD_THICKNESS, y1 - y0, z1 - z0]} tone="mid" />
      <Lines tone="mid" d={[middle - 8, middle + 8].map(y => pathOf([[0.7, y, z1], nail])).join("")} />
      <Dots tone="hi" radius={0.7} points={[nail]} />
      {pagesBehindFront > 0 && (
        <Solid box={[BOARD_THICKNESS, pagesLeft, pagesBottom, stackDepth, pagesRight - pagesLeft, pagesTop - pagesBottom]} tone="lo">
          <Lines
            tone="faint"
            d={range(pagesBehindFront - 1)
              .map(page => BOARD_THICKNESS + ((page + 1) * stackDepth) / pagesBehindFront)
              .map(
                x =>
                  pathOf([
                    [x, pagesLeft, pagesTop],
                    [x, pagesRight, pagesTop]
                  ]) +
                  pathOf([
                    [x, pagesRight, pagesBottom],
                    [x, pagesRight, pagesTop]
                  ])
              )
              .join("")}
          />
        </Solid>
      )}
      <Solid box={boxOf(frontPage, pagesBottom, pagesTop - pagesBottom)} tone="hi" isLit={isLit}>
        <Lines tone="mid" d={seamPath(frontPage, grid.top + 2.4)} />
        <Lines
          tone="lo"
          d={
            closedPath(sideRect(grid.left, grid.right, grid.bottom, grid.top, face)) +
            range(CALENDAR_COLUMNS - 1)
              .map(column => grid.right - cellWidth * (column + 1))
              .map(y =>
                pathOf([
                  [face, y, grid.bottom],
                  [face, y, grid.top]
                ])
              )
              .join("") +
            range(CALENDAR_ROWS - 1)
              .map(row => grid.bottom + cellHeight * (row + 1))
              .map(z =>
                pathOf([
                  [face, grid.left, z],
                  [face, grid.right, z]
                ])
              )
              .join("")
          }
        />
        {startCell && (
          <Dots tone="hi" radius={0.9} points={[[face, grid.right - cellWidth * (startCell.column + 0.5), grid.top - cellHeight * (startCell.row + 0.5)]]} />
        )}
        <SideText at={[face, grid.right, grid.top + 4.4]} tone={isLit ? "hi" : "mid"} size={3.2}>
          {header}
        </SideText>
      </Solid>
      <Lines tone="mid" d={ringYs.map(y => pathOf(bindingRing(y, face, pagesTop))).join("")} />
      <Dots tone="mid" radius={0.42} points={ringYs.map((y): Point3 => [face, y, pagesTop - 2.4])} />
    </g>
  );
};

/** A binding ring arcs from the board over the pages and down into the front page. */
function bindingRing(y: number, face: number, pagesTop: number): Point3[] {
  return range(RING_CURVE_STEPS + 1).map(step => {
    const progress = step / RING_CURVE_STEPS;
    const [fromBoard, overPages, intoPage] = [(1 - progress) ** 2, 2 * (1 - progress) * progress, progress ** 2];

    return [
      fromBoard * BOARD_THICKNESS + overPages * ((BOARD_THICKNESS + face) / 2) + intoPage * face,
      y,
      fromBoard * (pagesTop + 2.5) + overPages * (pagesTop + 7.5) + intoPage * (pagesTop - 2.4)
    ];
  });
}
