"use client";
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { format } from "date-fns";
import { Plus } from "lucide-react";

import type { Project, ProjectDeploymentPreview, ProjectDeploymentStatus } from "@src/types/project";
import { pluralize } from "@src/utils/stringUtils";
import { isProblemStatus, selectFolderSheets } from "../projectSummary";
import styles from "./ProjectFolder.module.css";

export const DEPLOYMENT_STATUS_TONES: Record<ProjectDeploymentStatus, { label: string; color: string }> = {
  running: { label: "Running", color: "#0E9F6E" },
  pending: { label: "Spinning up", color: "#2563EB" },
  degraded: { label: "Degraded", color: "#DC2626" }
};

/** Rest tilt and shift of a filed sheet, indexed by its distance from the front of the folder. */
const SHEET_TILT_DEG = [-0.6, 1.1, -1.4];
const SHEET_SHIFT_PX = [0, 3, -4];

type SheetStyle = CSSProperties & { "--j": number; "--r"?: string; "--x"?: string; "--tone"?: string };
type BulkStyle = CSSProperties & { "--k": number };

interface Props {
  project: Project;
  onOpen: () => void;
  onSelectDeployment: (deployment: ProjectDeploymentPreview) => void;
  /** Left out for a member who cannot deploy, which also drops the empty folder's "New deployment" sheet. */
  onNewDeployment?: () => void;
  /** The project actions, shown next to its name for the members who may manage projects. */
  menu?: ReactNode;
}

/** A project drawn as a folder with its active deployments filed inside; hovering or focusing it tips the folder open. */
export function ProjectFolder({ project, onOpen, onSelectDeployment, onNewDeployment, menu }: Props) {
  const activeCount = project.deployments?.activeCount;
  const { sheets, bulkEdges } = selectFolderSheets(project.deployments);

  const openOnEnterOrSpace = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  const pick = (action: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    action();
  };

  return (
    <div
      role="link"
      tabIndex={0}
      className={styles.folder}
      onClick={onOpen}
      onKeyDown={openOnEnterOrSpace}
      aria-label={activeCount === undefined ? `Open ${project.name}` : `Open ${project.name}, ${pluralize(activeCount, "active deployment")}`}
    >
      <div className={styles.inner}>
        <span className={styles.tab} aria-hidden="true" />
        <span className={styles.back} aria-hidden="true" />

        <div className={styles.sheets} aria-hidden="true">
          {Array.from({ length: bulkEdges }, (_, index) => (
            <span key={index} className={styles.bulk} style={bulkStyle(bulkEdges - 1 - index)} />
          ))}

          {sheets.length === 0 && onNewDeployment && (
            <span className={cn(styles.sheet, styles.ghost)} style={sheetStyle(0)} onClick={pick(onNewDeployment)}>
              <span className={styles.sheetHead}>
                <Plus className="h-3 w-3" />
                New deployment
              </span>
            </span>
          )}

          {sheets.map((sheet, index) => {
            const distanceFromFront = sheets.length - 1 - index;

            if (sheet.kind === "more") {
              return (
                <span key="more" className={styles.sheet} style={sheetStyle(distanceFromFront)} onClick={pick(onOpen)}>
                  <span className={cn(styles.sheetHead, styles.sheetMore)}>+{sheet.count} more</span>
                </span>
              );
            }

            const tone = DEPLOYMENT_STATUS_TONES[sheet.deployment.status];
            const hasProblem = isProblemStatus(sheet.deployment.status);
            return (
              <span
                key={sheet.deployment.dseq}
                className={styles.sheet}
                data-flag={hasProblem ? "" : undefined}
                style={sheetStyle(distanceFromFront, tone.color)}
                onClick={pick(() => onSelectDeployment(sheet.deployment))}
              >
                <span className={styles.sheetHead}>
                  <span className={styles.dot} />
                  <span className={styles.sheetName}>{sheet.deployment.name || `Deployment #${sheet.deployment.dseq}`}</span>
                  {hasProblem && <span className={styles.sheetStatus}>{tone.label}</span>}
                </span>
              </span>
            );
          })}
        </div>

        <div className={styles.front}>
          <div className="flex items-start justify-between gap-2">
            <span className={styles.name}>{project.name}</span>
            {menu && (
              <span onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
                {menu}
              </span>
            )}
          </div>
          <p className={cn(styles.description, !project.description && styles.descriptionEmpty)}>{project.description || "No description"}</p>
          <span className={styles.meta}>
            {describeActiveCount(activeCount)}Created {format(new Date(project.createdAt), "MMM d, yyyy")}
          </span>
        </div>
      </div>
    </div>
  );
}

/** An unknown count (hidden from the caller, or too many to count) says nothing rather than claiming the project is empty. */
function describeActiveCount(activeCount: number | undefined): string {
  if (activeCount === undefined) return "";
  return activeCount > 0 ? `${activeCount} active · ` : "Empty · ";
}

function sheetStyle(distanceFromFront: number, tone?: string): SheetStyle {
  return {
    "--j": distanceFromFront,
    "--r": `${SHEET_TILT_DEG[distanceFromFront] ?? 0}deg`,
    "--x": `${SHEET_SHIFT_PX[distanceFromFront] ?? 0}px`,
    "--tone": tone
  };
}

function bulkStyle(edgeIndex: number): BulkStyle {
  return { "--k": edgeIndex };
}
