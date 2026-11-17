import type { CSSProperties, FC, KeyboardEvent, ReactNode } from "react";
import { useState } from "react";
import { PencilIcon } from "lucide-react";

import type { QuoteStepId } from "../gpuQuoteDraft/gpuQuoteDraft";
import styles from "./GpuRackBuild.module.css";
import type { RackBuild, RackCallout, RackPart } from "./rackBuild";
import { DriveBays, PowerStrips, RackBack, RackContents, RackFront, RackNetwork } from "./RackCabinet";
import { slideFrom, VIEW } from "./rackGeometry";
import { RaisedFloor, Ups, WallCalendar } from "./RackRoom";

const CHANGE_LABELS: Record<RackPart, string> = {
  rack: "Change the setup",
  servers: "Change the GPUs",
  network: "Change the network",
  storage: "Change the storage",
  floor: "Change the region",
  power: "Change the uptime",
  calendar: "Change the term"
};

type Props = { build: RackBuild; onChangeStep: (step: QuoteStepId) => void };

export const GpuRackBuild: FC<Props> = ({ build, onChangeStep }) => {
  const [hoveredPart, setHoveredPart] = useState<RackPart | null>(null);
  const [focusedPart, setFocusedPart] = useState<RackPart | null>(null);
  const callouts = useArrivalOrder(build.callouts);
  const { isBuilt, slots } = build;
  const isHot = (part: RackPart) => hoveredPart === part || focusedPart === part;
  const isLit = (part: RackPart) => build.currentPart === part || isHot(part) || (build.isReview && part === "servers");

  function partHandlers(part: RackPart) {
    return {
      onClick: () => onChangeStep(build.stepOfPart[part]),
      onMouseEnter: () => setHoveredPart(part),
      onMouseLeave: () => setHoveredPart(null),
      onFocus: () => setFocusedPart(part),
      onBlur: () => setFocusedPart(null)
    };
  }

  return (
    <div className={styles.root}>
      <svg className={styles.svg} viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="group" aria-label="Server room parts">
        {isBuilt.floor && (
          <ClickablePart part="floor" partHandlers={partHandlers} from={slideFrom(0, 0, -40)}>
            <RaisedFloor isLit={isLit("floor")} />
          </ClickablePart>
        )}
        {isBuilt.calendar && (
          <ClickablePart part="calendar" partHandlers={partHandlers} from={slideFrom(0, -48, 0, 60)}>
            <WallCalendar calendar={build.calendar} isLit={isLit("calendar")} />
          </ClickablePart>
        )}
        <ClickablePart part="rack" partHandlers={partHandlers}>
          <RackBack isLit={isLit("rack")} />
        </ClickablePart>
        {isBuilt.servers && (
          <ClickablePart part="servers" partHandlers={partHandlers} from={slideFrom(0, 60, 0, 60)}>
            <RackContents slots={slots} blankSpans={build.blankSpans} isLit={isLit("servers")} isOn={build.isPowered} />
          </ClickablePart>
        )}
        {isBuilt.storage && (
          <ClickablePart part="storage" partHandlers={partHandlers} from={slideFrom(0, 14, 0, 140)}>
            <DriveBays slots={slots} drives={build.drives} isLit={isLit("storage")} />
          </ClickablePart>
        )}
        {isBuilt.network && (
          <ClickablePart part="network" partHandlers={partHandlers} from={slideFrom(0, 0, 30, 100)}>
            <RackNetwork slots={slots} isLit={isLit("network")} />
          </ClickablePart>
        )}
        {isBuilt.power && (
          <ClickablePart part="power" partHandlers={partHandlers} from={slideFrom(0, 0, 24, 80)}>
            <PowerStrips count={build.powerStrips} isLit={isLit("power")} isOn={build.isPowered} />
          </ClickablePart>
        )}
        <ClickablePart part="rack" partHandlers={partHandlers} isRepeat>
          <RackFront isLit={isLit("rack")} isOn={build.isPowered} />
        </ClickablePart>
        {build.hasUps && (
          <ClickablePart part="power" partHandlers={partHandlers} from={slideFrom(40, 0, 0, 140)} isRepeat>
            <Ups isLit={isLit("power")} isOn={build.isPowered} />
          </ClickablePart>
        )}
      </svg>
      <div className={styles.callouts}>
        {callouts.map(callout => (
          <button
            key={callout.part}
            type="button"
            className={styles.callout}
            data-hot={isHot(callout.part) || undefined}
            aria-current={build.currentPart === callout.part ? "step" : undefined}
            title={CHANGE_LABELS[callout.part]}
            aria-label={`Change ${callout.label}: ${callout.value}`}
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
  );
};

type PartHandlers = (part: RackPart) => {
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
};

type ClickablePartProps = { part: RackPart; partHandlers: PartHandlers; from?: CSSProperties; isRepeat?: boolean; children: ReactNode };

/** A part drawn in two pieces, such as the cabinet behind and in front of its contents, is one stop for the keyboard: only its first piece is focusable. */
const ClickablePart: FC<ClickablePartProps> = ({ part, partHandlers, from, isRepeat = false, children }) => {
  const handlers = partHandlers(part);

  function changeOnKey(event: KeyboardEvent<SVGGElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    handlers.onClick();
  }

  return (
    <g
      className={styles.part}
      data-part={part}
      role="button"
      tabIndex={isRepeat ? -1 : 0}
      aria-label={CHANGE_LABELS[part]}
      aria-hidden={isRepeat || undefined}
      onKeyDown={changeOnKey}
      {...handlers}
    >
      <title>{CHANGE_LABELS[part]}</title>
      {from ? (
        <g className={styles.slideIn} style={from}>
          {children}
        </g>
      ) : (
        children
      )}
    </g>
  );
};

/** A callout keeps the slot it first arrived in, so changing an answer never moves a label the user has already read. */
function useArrivalOrder(callouts: RackCallout[]): RackCallout[] {
  const [arrivedParts, setArrivedParts] = useState<RackCallout["part"][]>([]);
  const newParts = callouts.map(callout => callout.part).filter(part => !arrivedParts.includes(part));
  const order = [...arrivedParts, ...newParts];

  if (newParts.length > 0) setArrivedParts(order);

  return [...callouts].sort((first, second) => order.indexOf(first.part) - order.indexOf(second.part));
}
