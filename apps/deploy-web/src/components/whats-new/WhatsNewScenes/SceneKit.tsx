"use client";
import type { CSSProperties, ReactNode } from "react";
import { forwardRef, useCallback, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronsUpDown, FolderPlus, Info, Plus, Search, X } from "lucide-react";

import { AkashConsoleLogo } from "@src/components/icons/AkashConsoleLogo";
import type { FolderState } from "./sceneMath";
import { clamp, EASE, mix, pressAmount, progressBetween, SCENE_HEIGHT, SCENE_WIDTH, SHUT_FOLDER } from "./sceneMath";

export const COLOR = {
  foreground: "hsl(var(--foreground))",
  background: "hsl(var(--background))",
  card: "hsl(var(--card))",
  muted: "hsl(var(--muted))",
  mutedForeground: "hsl(var(--muted-foreground))",
  border: "hsl(var(--border))",
  popover: "hsl(var(--popover))",
  ring: "hsl(var(--ring))"
};

const MONO = "var(--font-geist-mono)";

const ICON_STYLE: CSSProperties = { display: "block", flexShrink: 0 };

const STATUS_TONE = { running: "#0E9F6E", spinning: "#2563EB", setup: "#D97706", reclaiming: "#D97706" };
const STATUS_LABEL: Partial<Record<keyof typeof STATUS_TONE, string>> = { spinning: "Spinning up", setup: "Needs setup", reclaiming: "Reclaiming" };
const SHEET_TILT = [-0.6, 1.1, -1.4];
const SHEET_SHIFT = [0, 3, -4];

export type SceneOrganization = { id: string; name: string; isPersonal?: boolean; hue?: number; role?: string };

export type SceneProject = {
  name: string;
  description: string;
  meta: string;
  deployments: { name: string; status?: keyof typeof STATUS_TONE }[];
};

function mutedOver(progress: number, base = COLOR.background) {
  return `color-mix(in oklab, ${COLOR.muted} ${Math.round(clamp(progress) * 100)}%, ${base})`;
}

function hueOf(name: string) {
  let hash = 2166136261;
  for (const character of name) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 360;
}

function SceneLogo({ height, style }: { height: number; style?: CSSProperties }) {
  return (
    <span aria-hidden="true" style={style}>
      <AkashConsoleLogo size={{ width: Math.round((height * 1497) / 164), height }} />
    </span>
  );
}

function ProfileAvatar({ size = 28 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        display: "inline-block",
        flexShrink: 0,
        background: "radial-gradient(circle at 30% 25%, #FFD86B 0%, #FF7A8A 25%, #C159F0 55%, #5B6DF6 85%, #1C1B5E 100%)",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)"
      }}
    />
  );
}

function OrganizationBadge({ organization, size = 22 }: { organization: SceneOrganization; size?: number }) {
  if (organization.isPersonal) return <ProfileAvatar size={size} />;
  const hue = organization.hue ?? hueOf(organization.name);
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: `oklch(0.93 0.05 ${hue})`,
        color: `oklch(0.38 0.13 ${hue})`,
        boxShadow: `inset 0 0 0 1px oklch(0.84 0.07 ${hue})`,
        fontSize: Math.round(size * 0.48),
        fontWeight: 650,
        lineHeight: 1
      }}
    >
      {organization.name.charAt(0).toUpperCase()}
    </span>
  );
}

function SwitcherPill({ organization, highlight }: { organization: SceneOrganization; highlight: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 34,
        padding: "0 10px 0 6px",
        borderRadius: 9,
        border: `1px solid ${COLOR.border}`,
        background: mutedOver(highlight),
        fontSize: 13.5,
        fontWeight: 600,
        whiteSpace: "nowrap"
      }}
    >
      <span style={{ display: "inline-flex" }}>
        <OrganizationBadge organization={organization} size={22} />
      </span>
      <span>{organization.name}</span>
      <span data-scene-anchor="switcher-chevron" style={{ display: "inline-flex", color: COLOR.mutedForeground }}>
        <ChevronsUpDown size={14} strokeWidth={1.75} style={ICON_STYLE} />
      </span>
    </span>
  );
}

function SceneHeader({ organization, switcherHighlight }: { organization: SceneOrganization; switcherHighlight: number }) {
  return (
    <div
      style={{ position: "absolute", left: 0, top: 0, width: SCENE_WIDTH, height: 56, background: COLOR.background, borderBottom: `1px solid ${COLOR.border}` }}
    >
      <SceneLogo height={16} style={{ position: "absolute", left: 24, top: 20 }} />
      <div
        style={{
          position: "absolute",
          left: 202,
          top: 0,
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 20,
          fontSize: 13,
          fontWeight: 500,
          color: COLOR.mutedForeground
        }}
      >
        <span style={{ color: COLOR.foreground }}>Projects</span>
        <span>Templates</span>
        <span>Providers</span>
        <span>Settings</span>
      </div>
      <div style={{ position: "absolute", right: 24, top: 0, height: 56, display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 34,
            padding: "0 10px",
            whiteSpace: "nowrap",
            borderRadius: 9,
            border: `1px solid ${COLOR.border}`,
            fontFamily: MONO,
            fontSize: 12,
            color: COLOR.mutedForeground
          }}
        >
          <Search size={14} strokeWidth={1.75} style={ICON_STYLE} />
          ⌘K
        </span>
        <SwitcherPill organization={organization} highlight={switcherHighlight} />
        <ProfileAvatar size={30} />
      </div>
    </div>
  );
}

function SceneTitleBar({
  newProjectHighlight,
  newProjectPress,
  hasNewDeployment
}: {
  newProjectHighlight: number;
  newProjectPress: number;
  hasNewDeployment: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 56,
        width: SCENE_WIDTH,
        height: 60,
        background: COLOR.background,
        borderBottom: `1px solid ${COLOR.border}`
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 24,
          top: 0,
          height: 60,
          display: "flex",
          alignItems: "center",
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "-0.02em"
        }}
      >
        Projects
      </span>
      <div style={{ position: "absolute", right: 24, top: 0, height: 60, display: "flex", alignItems: "center", gap: 10 }}>
        <span
          data-scene-anchor="new-project"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 34,
            whiteSpace: "nowrap",
            padding: "0 12px",
            borderRadius: 8,
            border: `1px solid ${COLOR.border}`,
            background: mutedOver(newProjectHighlight),
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 1px 1px 0 rgba(0,0,0,0.05)",
            transform: `scale(${1 - 0.05 * newProjectPress})`
          }}
        >
          <FolderPlus size={13} strokeWidth={1.75} style={ICON_STYLE} />
          New project
        </span>
        {hasNewDeployment && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 36,
              whiteSpace: "nowrap",
              padding: "0 18px",
              borderRadius: 10,
              background: COLOR.foreground,
              color: COLOR.background,
              fontSize: 13,
              fontWeight: 600
            }}
          >
            New deployment
            <ArrowRight size={15} strokeWidth={1.75} style={ICON_STYLE} />
          </span>
        )}
      </div>
    </div>
  );
}

function SceneSectionLabel({ count }: { count?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 24,
        right: 24,
        top: 126,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: COLOR.mutedForeground }}>All projects</span>
      {count && <span style={{ fontSize: 12, color: COLOR.mutedForeground }}>{count}</span>}
    </div>
  );
}

type ScenePageProps = {
  organization: SceneOrganization;
  count?: string;
  switcherHighlight?: number;
  newProjectHighlight?: number;
  newProjectPress?: number;
  hasNewDeployment?: boolean;
  children: ReactNode;
};

export function ScenePage({
  organization,
  count,
  switcherHighlight = 0,
  newProjectHighlight = 0,
  newProjectPress = 0,
  hasNewDeployment = true,
  children
}: ScenePageProps) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 116,
          width: SCENE_WIDTH,
          height: SCENE_HEIGHT - 116,
          backgroundImage: `radial-gradient(circle, color-mix(in oklab, ${COLOR.foreground} 3.5%, transparent) 2px, transparent 2px)`,
          backgroundSize: "26px 26px"
        }}
      />
      {children}
      <SceneHeader organization={organization} switcherHighlight={switcherHighlight} />
      <SceneTitleBar newProjectHighlight={newProjectHighlight} newProjectPress={newProjectPress} hasNewDeployment={hasNewDeployment} />
      <SceneSectionLabel count={count} />
    </>
  );
}

type SceneFolderProps = {
  x: number;
  y: number;
  project: SceneProject;
  state?: FolderState;
  hoveredDepth?: number;
  hover?: number;
  ghost?: number;
  appear?: number;
};

export function SceneFolder({ x, y, project, state = SHUT_FOLDER, hoveredDepth = -1, hover = 0, ghost = 0, appear = 1 }: SceneFolderProps) {
  const sheetCount = project.deployments.length;
  const openness = state.base;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 366,
        height: 226,
        opacity: clamp(appear),
        transform: `scale(${0.95 + 0.05 * appear})`,
        transformOrigin: "50% 70%"
      }}
    >
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${-2 * openness}px)` }}>
        <div
          style={{ position: "absolute", left: 0, top: 40, width: "36%", height: 26, borderRadius: "10px 10px 0 0", background: "var(--scene-folder-back)" }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: -13,
              width: 26,
              borderRadius: "0 9px 0 0",
              background: "var(--scene-folder-back)",
              transform: "skewX(30deg)",
              transformOrigin: "0 100%"
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 58,
            bottom: 0,
            borderRadius: "0 12px 14px 14px",
            background: "var(--scene-folder-back)",
            boxShadow: `0 ${mix(1, 18, openness)}px ${mix(2, 32, openness)}px ${mix(0, -20, openness)}px rgba(0,0,0,${mix(0.06, 0.4, openness)})`
          }}
        />
        <div style={{ position: "absolute", left: 14, right: 14, top: 0, bottom: 0 }}>
          {sheetCount === 0 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 80,
                height: 118,
                borderRadius: 8,
                border: `1px dashed color-mix(in oklab, ${COLOR.foreground} 30%, transparent)`,
                opacity: clamp(ghost),
                transform: `translateY(${-24 * state.sheet(0)}px)`
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", height: 24, padding: "0 10px", fontSize: 12, fontWeight: 500, color: COLOR.mutedForeground }}
              >
                + New deployment
              </div>
            </div>
          )}
          {project.deployments.map((deployment, index) => {
            const depth = sheetCount - 1 - index;
            const sheetOpenness = state.sheet(depth);
            const lift = depth === hoveredDepth ? 5 * hover : 0;
            const isLifted = lift > 0;
            const tone = STATUS_TONE[deployment.status ?? "running"];
            const label = deployment.status && STATUS_LABEL[deployment.status];
            return (
              <div
                key={deployment.name}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 80 - depth * 8,
                  height: 118,
                  borderRadius: 8,
                  background: "var(--scene-folder-sheet)",
                  border: "1px solid var(--scene-folder-sheet-line)",
                  boxShadow: `0 ${mix(1, 8, isLifted ? hover : 0)}px ${mix(3, 16, isLifted ? hover : 0)}px ${isLifted ? -8 * hover : 0}px rgba(0,0,0,${isLifted ? mix(0.08, 0.3, hover) : 0.08})`,
                  transform: `translate(${SHEET_SHIFT[depth] * (1 - sheetOpenness)}px, ${-(24 + 16 * depth) * sheetOpenness - lift}px) rotate(${SHEET_TILT[depth] * (1 - sheetOpenness)}deg)`
                }}
              >
                {label && (
                  <div
                    style={{
                      position: "absolute",
                      top: -7,
                      right: 18,
                      width: 24,
                      height: 8,
                      borderRadius: "3px 3px 0 0",
                      background: tone,
                      opacity: 1 - state.head
                    }}
                  />
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    height: 24,
                    padding: "0 10px",
                    fontFamily: MONO,
                    fontSize: 11.5,
                    opacity: state.head
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 9999, background: tone, flexShrink: 0 }} />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      textDecoration: lift > 2.5 ? "underline" : "none",
                      textUnderlineOffset: 3
                    }}
                  >
                    {deployment.name}
                  </span>
                  {label && <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, color: tone }}>{label}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 92,
            bottom: 0,
            overflow: "hidden",
            padding: "14px 18px 13px",
            display: "flex",
            flexDirection: "column",
            gap: 5,
            borderRadius: "10px 10px 14px 14px",
            background: "var(--scene-folder-front)",
            border: "1px solid var(--scene-folder-front-line)",
            transformOrigin: "50% 100%",
            transform: `perspective(900px) rotateX(${-16 * openness}deg)`,
            boxShadow: `0 ${mix(-6, -10, openness)}px ${mix(12, 18, openness)}px ${mix(-10, -12, openness)}px rgba(0,0,0,${mix(0.25, 0.3, openness)}), 0 ${mix(1, 12, openness)}px ${mix(2, 24, openness)}px ${mix(0, -14, openness)}px rgba(0,0,0,${mix(0.05, 0.3, openness)})`
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {project.name}
          </span>
          <span
            style={{
              fontSize: 13,
              lineHeight: "19px",
              minHeight: 38,
              whiteSpace: "normal",
              color: COLOR.mutedForeground,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}
          >
            {project.description}
          </span>
          <span style={{ marginTop: "auto", fontSize: 12, color: COLOR.mutedForeground }}>{project.meta}</span>
        </div>
      </div>
    </div>
  );
}

const MENU_SECTION_STYLE: CSSProperties = {
  padding: "8px 9px 5px",
  fontFamily: MONO,
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: COLOR.mutedForeground
};

type SceneOrganizationMenuProps = {
  openness: number;
  personal: SceneOrganization;
  teams: SceneOrganization[];
  currentId: string;
  hoveredRow?: number;
};

/** Rows are numbered top to bottom: the personal account, each team, then "Create organization". */
export function SceneOrganizationMenu({ openness, personal, teams, currentId, hoveredRow = -1 }: SceneOrganizationMenuProps) {
  const createRow = teams.length + 1;
  const rowStyle = (row: number): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    minHeight: 36,
    padding: "0 9px",
    borderRadius: 7,
    background: hoveredRow === row ? COLOR.muted : "transparent",
    fontSize: 13.5,
    fontWeight: 500
  });
  const renderRow = (organization: SceneOrganization, row: number) => (
    <div key={organization.id} data-scene-anchor={`menu-${organization.id}`} style={rowStyle(row)}>
      <OrganizationBadge organization={organization} size={20} />
      <span style={{ flex: 1, minWidth: 0 }}>{organization.name}</span>
      {organization.role && <span style={{ fontSize: 12, fontWeight: 400, color: COLOR.mutedForeground }}>{organization.role}</span>}
      <span style={{ width: 14, display: "inline-flex" }}>{currentId === organization.id && <Check size={14} strokeWidth={1.75} style={ICON_STYLE} />}</span>
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 446,
        top: 51,
        width: 292,
        padding: 5,
        borderRadius: 11,
        background: COLOR.popover,
        border: `1px solid ${COLOR.border}`,
        boxShadow: "0 16px 38px -12px rgba(0,0,0,0.28)",
        zIndex: 30,
        visibility: openness > 0.001 ? "visible" : "hidden",
        opacity: openness,
        transform: `translateY(${-4 * (1 - openness)}px) scale(${0.985 + 0.015 * openness})`,
        transformOrigin: "100% 0"
      }}
    >
      <div style={MENU_SECTION_STYLE}>Personal account</div>
      {renderRow(personal, 0)}
      <div style={MENU_SECTION_STYLE}>Organizations</div>
      {teams.map((team, index) => renderRow(team, index + 1))}
      <div style={{ height: 1, background: COLOR.border, margin: "5px 0" }} />
      <div data-scene-anchor="menu-create" style={rowStyle(createRow)}>
        <span style={{ width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", color: COLOR.mutedForeground }}>
          <Plus size={15} strokeWidth={1.75} style={ICON_STYLE} />
        </span>
        <span>Create organization</span>
      </div>
    </div>
  );
}

export function SceneModalLayer({ openness, children }: { openness: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 40,
        visibility: openness > 0.001 ? "visible" : "hidden"
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", opacity: openness }} />
      {children}
    </div>
  );
}

type SceneModalProps = { openness: number; width: number; title: string; description: string; footer: ReactNode; children: ReactNode };

export function SceneModal({ openness, width, title, description, footer, children }: SceneModalProps) {
  return (
    <div
      style={{
        position: "relative",
        width,
        opacity: openness,
        transform: `translateY(${(1 - openness) * 12}px) scale(${0.97 + 0.03 * openness})`,
        background: COLOR.background,
        border: `1px solid ${COLOR.border}`,
        borderRadius: 12,
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 20px 12px", borderBottom: `1px solid ${COLOR.border}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{title}</div>
          <div style={{ fontSize: 12, lineHeight: 1.45, color: COLOR.mutedForeground, marginTop: 4, whiteSpace: "normal" }}>{description}</div>
        </div>
        <span style={{ width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center", color: COLOR.mutedForeground }}>
          <X size={14} strokeWidth={1.75} style={ICON_STYLE} />
        </span>
      </div>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          padding: "12px 20px",
          borderTop: `1px solid ${COLOR.border}`,
          background: COLOR.muted,
          borderRadius: "0 0 12px 12px"
        }}
      >
        {footer}
      </div>
    </div>
  );
}

type SceneButtonProps = { kind: "primary" | "ghost"; anchor?: string; hover?: number; press?: number; isDisabled?: boolean; children: ReactNode };

export function SceneButton({ kind, anchor, hover = 0, press = 0, isDisabled = false, children }: SceneButtonProps) {
  const isPrimary = kind === "primary";
  const restingBackground = isPrimary ? COLOR.foreground : "transparent";
  const hoveredBackground = isPrimary
    ? `color-mix(in oklab, ${COLOR.mutedForeground} ${Math.round(hover * 14)}%, ${COLOR.foreground})`
    : mutedOver(hover, "transparent");
  return (
    <span
      data-scene-anchor={anchor}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 36,
        padding: "0 14px",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        whiteSpace: "nowrap",
        color: isPrimary ? COLOR.background : COLOR.foreground,
        border: `1px solid ${isPrimary ? COLOR.foreground : "transparent"}`,
        background: hover > 0 ? hoveredBackground : restingBackground,
        opacity: isDisabled ? 0.5 : 1,
        transform: `scale(${1 - 0.05 * press})`
      }}
    >
      {children}
    </span>
  );
}

export function SceneFieldLabel({ isOptional = false, children }: { isOptional?: boolean; children: ReactNode }) {
  return (
    <span style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 13, fontWeight: 500 }}>
      {children}
      {isOptional && <span style={{ fontSize: 12, fontWeight: 400, color: COLOR.mutedForeground }}>Optional</span>}
    </span>
  );
}

function focusRing(isFocused: boolean) {
  return isFocused ? `0 0 0 3px color-mix(in oklab, ${COLOR.ring} 22%, transparent)` : "0 1px 2px 0 rgba(0,0,0,0.04)";
}

function Caret({ opacity }: { opacity: number }) {
  return <span style={{ width: 1.5, height: 18, marginLeft: 1, background: COLOR.foreground, opacity, flexShrink: 0 }} />;
}

type SceneFieldProps = {
  label: string;
  isOptional?: boolean;
  value: string;
  placeholder: string;
  hint?: string;
  isFocused: boolean;
  caret: number;
  rows?: number;
  anchor?: string;
};

export function SceneField({ label, isOptional, value, placeholder, hint, isFocused, caret, rows = 0, anchor }: SceneFieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <SceneFieldLabel isOptional={isOptional}>{label}</SceneFieldLabel>
      <div
        data-scene-anchor={anchor}
        style={{
          display: "flex",
          alignItems: rows ? "flex-start" : "center",
          minHeight: rows ? 20 * rows + 18 : 36,
          padding: rows ? "9px 12px" : "0 12px",
          borderRadius: 8,
          border: `1px solid ${COLOR.border}`,
          background: COLOR.background,
          fontSize: 14,
          lineHeight: "20px",
          boxShadow: focusRing(isFocused)
        }}
      >
        {value && <span style={{ whiteSpace: "pre" }}>{value}</span>}
        {isFocused && <Caret opacity={caret} />}
        {!value && <span style={{ color: COLOR.mutedForeground }}>{placeholder}</span>}
      </div>
      {hint && <span style={{ fontSize: 12, color: COLOR.mutedForeground }}>{hint}</span>}
    </div>
  );
}

type SceneChipsProps = { chips: [label: string, appear: number][]; typing: string; isFocused: boolean; caret: number; anchor?: string };

export function SceneChips({ chips, typing, isFocused, caret, anchor }: SceneChipsProps) {
  const shown = chips.filter(([, appear]) => appear > 0.001);
  return (
    <div
      data-scene-anchor={anchor}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
        minHeight: 36,
        padding: "5px 8px",
        borderRadius: 8,
        border: `1px solid ${COLOR.border}`,
        background: COLOR.background,
        fontSize: 14,
        lineHeight: "20px",
        boxShadow: focusRing(isFocused)
      }}
    >
      {shown.map(([label, appear]) => (
        <span
          key={label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            height: 24,
            padding: "0 5px 0 8px",
            borderRadius: 6,
            background: COLOR.muted,
            border: `1px solid ${COLOR.border}`,
            fontSize: 12.5,
            fontWeight: 500,
            opacity: clamp(appear * 1.6),
            transform: `scale(${0.85 + 0.15 * appear})`
          }}
        >
          {label}
          <X size={12} strokeWidth={1.75} color={COLOR.mutedForeground} style={ICON_STYLE} />
        </span>
      ))}
      <span style={{ display: "inline-flex", alignItems: "center", paddingLeft: 4 }}>
        {typing && <span style={{ whiteSpace: "pre" }}>{typing}</span>}
        {isFocused && <Caret opacity={caret} />}
        {!typing && !shown.length && <span style={{ color: COLOR.mutedForeground }}>name@company.com</span>}
      </span>
    </div>
  );
}

export function SceneInfoNote({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 12px",
        borderRadius: 8,
        background: COLOR.muted,
        fontSize: 12.5,
        color: COLOR.mutedForeground
      }}
    >
      <Info size={14} strokeWidth={1.75} style={ICON_STYLE} />
      <span>{children}</span>
    </div>
  );
}

export function SceneToast({ openness, title, description }: { openness: number; title: string; description?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        top: 12,
        width: 300,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 12,
        background: COLOR.card,
        border: `1px solid ${COLOR.border}`,
        boxShadow: "0 10px 32px -8px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.06)",
        zIndex: 45,
        visibility: openness > 0.001 ? "visible" : "hidden",
        opacity: openness,
        transform: `translateX(${-24 * (1 - openness)}px)`
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 9999,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "color-mix(in oklab, #10B981 16%, transparent)"
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 9999, background: "#10B981" }} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 550, lineHeight: "19px" }}>{title}</span>
        {description && <span style={{ fontSize: 12.5, lineHeight: "18px", color: COLOR.mutedForeground }}>{description}</span>}
      </span>
    </div>
  );
}

export function SceneEmptyProjects({ organization, appear }: { organization: SceneOrganization; appear: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 24,
        right: 24,
        top: 160,
        height: 250,
        borderRadius: 16,
        border: `1px dashed ${COLOR.border}`,
        background: `color-mix(in oklab, ${COLOR.background} 70%, transparent)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        textAlign: "center",
        opacity: appear,
        transform: `translateY(${6 * (1 - appear)}px)`
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: COLOR.mutedForeground }}>
        {`0 projects in ${organization.name}`}
      </span>
      <span style={{ fontSize: 20, fontWeight: 600 }}>Create your first project</span>
      <span style={{ fontSize: 13.5, color: COLOR.mutedForeground }}>A project groups the deployments behind one app or service.</span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 36,
          padding: "0 18px",
          marginTop: 4,
          borderRadius: 10,
          background: COLOR.foreground,
          color: COLOR.background,
          fontSize: 13,
          fontWeight: 600
        }}
      >
        <Plus size={14} strokeWidth={1.75} style={ICON_STYLE} />
        New project
      </span>
    </div>
  );
}

export function SceneCursor({ x, y, time, clicks = [], zoom }: { x: number; y: number; time: number; clicks?: number[]; zoom: number }) {
  const press = clicks.reduce((strongest, clickAt) => Math.max(strongest, pressAmount(time, clickAt)), 0);
  const ripple = clicks.map(clickAt => progressBetween(time, clickAt, clickAt + 0.5)).find(progress => progress > 0 && progress < 1);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, zIndex: 60, transform: `scale(${1 / Math.sqrt(zoom)})` }}>
      {ripple !== undefined && (
        <span
          style={{
            position: "absolute",
            left: -20,
            top: -20,
            width: 40,
            height: 40,
            borderRadius: 9999,
            background: `color-mix(in oklab, ${COLOR.foreground} 14%, transparent)`,
            border: `1.5px solid color-mix(in oklab, ${COLOR.foreground} 32%, transparent)`,
            transform: `scale(${0.25 + 0.85 * EASE.out(ripple)})`,
            opacity: 1 - ripple
          }}
        />
      )}
      <svg
        width="22"
        height="24"
        viewBox="0 0 22 24"
        style={{
          position: "absolute",
          left: -4,
          top: -2,
          overflow: "visible",
          transform: `scale(${1 - 0.14 * press})`,
          transformOrigin: "4px 2px",
          filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.35))"
        }}
      >
        <path d="M4 2.5v17.6l4.5-4.2 2.9 6.6 3-1.3-2.9-6.5h6.2z" fill="#0A0A0A" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export type SceneCamera = [centerX: number, centerY: number, zoom: number];

/** The camera is clamped so the view never leaves the canvas. */
export const SceneCanvas = forwardRef<HTMLDivElement, { camera: SceneCamera; veil: number; children: ReactNode }>(function SceneCanvas(
  { camera, veil, children },
  ref
) {
  const zoom = Math.max(1, camera[2]);
  const halfViewWidth = SCENE_WIDTH / (2 * zoom);
  const halfViewHeight = SCENE_HEIGHT / (2 * zoom);
  const centerX = clamp(camera[0], halfViewWidth, SCENE_WIDTH - halfViewWidth);
  const centerY = clamp(camera[1], halfViewHeight, SCENE_HEIGHT - halfViewHeight);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT, overflow: "hidden", background: COLOR.background }}>
      <div
        ref={ref}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: SCENE_WIDTH,
          height: SCENE_HEIGHT,
          transformOrigin: "0 0",
          transform: `translate(${SCENE_WIDTH / 2}px, ${SCENE_HEIGHT / 2}px) scale(${zoom}) translate(${-centerX}px, ${-centerY}px)`
        }}
      >
        {children}
      </div>
      {veil > 0.001 && <div style={{ position: "absolute", inset: 0, background: COLOR.background, opacity: veil }} />}
    </div>
  );
});

type AnchorBox = { centerX: number; centerY: number };

/** Offsets ignore the camera and entrance transforms, so the cursor lands on the laid-out control. */
export function useSceneAnchors() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [anchors, setAnchors] = useState<Record<string, AnchorBox>>({});

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const measured: Record<string, AnchorBox> = {};
    root.querySelectorAll<HTMLElement>("[data-scene-anchor]").forEach(element => {
      let left = 0;
      let top = 0;
      let node: Element | null = element;
      while (node instanceof HTMLElement && node !== root) {
        left += node.offsetLeft;
        top += node.offsetTop;
        node = node.offsetParent;
      }
      if (node !== root) return;
      measured[element.dataset.sceneAnchor as string] = { centerX: left + element.offsetWidth / 2, centerY: top + element.offsetHeight / 2 };
    });
    setAnchors(previous => (JSON.stringify(previous) === JSON.stringify(measured) ? previous : measured));
  }, []);

  useLayoutEffect(
    function measureOnceLaidOutAndAgainOnceFontsLoad() {
      measure();
      let isMounted = true;
      document.fonts?.ready.then(() => {
        if (isMounted) measure();
      });
      const remeasureTimeout = setTimeout(measure, 400);
      return function stopMeasuring() {
        isMounted = false;
        clearTimeout(remeasureTimeout);
      };
    },
    [measure]
  );

  const anchorAt = (name: string, fallbackX: number, fallbackY: number, offsetX = 0, offsetY = 0): [number, number] => {
    const anchor = anchors[name];
    return anchor ? [anchor.centerX + offsetX, anchor.centerY + offsetY] : [fallbackX + offsetX, fallbackY + offsetY];
  };

  return { anchorAt, rootRef };
}
