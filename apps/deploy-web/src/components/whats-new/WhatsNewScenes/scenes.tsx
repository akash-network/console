"use client";
import type { ComponentType } from "react";

import type { SceneCamera, SceneOrganization, SceneProject } from "./SceneKit";
import {
  COLOR,
  SceneButton,
  SceneCanvas,
  SceneChips,
  SceneCursor,
  SceneEmptyProjects,
  SceneField,
  SceneFieldLabel,
  SceneFolder,
  SceneInfoNote,
  SceneModal,
  SceneModalLayer,
  SceneOrganizationMenu,
  ScenePage,
  SceneToast,
  useSceneAnchors
} from "./SceneKit";
import { caretOpacity, EASE, folderSlot, folderState, keyframes, mix, pressAmount, SHUT_FOLDER, tween, typedText, veilOpacity } from "./sceneMath";

const PERSONAL: SceneOrganization = { id: "personal", name: "Joshua Meyer", isPersonal: true };
const ACME: SceneOrganization = { id: "acme", name: "Acme Corp", hue: 252, role: "Admin" };
const NORTHWIND: SceneOrganization = { id: "northwind", name: "Northwind Labs", hue: 160, role: "Member" };
const HARBORLINE: SceneOrganization = { id: "harbor", name: "Harborline" };
const TEAMS = [ACME, NORTHWIND];

const PROJECT = {
  storefront: {
    name: "storefront",
    description: "Customer-facing shop: the Next.js web tier, its API, and the Postgres database behind it.",
    meta: "3 active · Created Oct 28, 2025",
    deployments: [{ name: "session-cache", status: "reclaiming" }, { name: "acme-storefront" }, { name: "storefront-api" }]
  },
  ai: {
    name: "ai-inference",
    description: "Self-hosted model endpoints for image generation and chat.",
    meta: "2 active · Created Dec 1, 2025",
    deployments: [{ name: "sdxl-image-api" }, { name: "support-bot" }]
  },
  media: {
    name: "media-pipeline",
    description: "GPU transcoding workers that pull render jobs off a NATS queue.",
    meta: "1 active · Created Apr 29, 2026",
    deployments: [{ name: "transcode-workers" }]
  },
  marketing: {
    name: "marketing",
    description: "acmecorp.com, the static marketing site.",
    meta: "1 active · Created May 6, 2026",
    deployments: [{ name: "acme-site" }]
  },
  playground: {
    name: "playground",
    description: "Notebooks and throwaway experiments.",
    meta: "2 active · Created Jan 30, 2026",
    deployments: [{ name: "jupyter-lab" }, { name: "hello-world" }]
  },
  checkout: { name: "checkout-api", description: "Payments API and its workers.", meta: "Empty · Created Oct 22, 2026", deployments: [] }
} satisfies Record<string, SceneProject>;

const ACME_PROJECTS: SceneProject[] = [PROJECT.storefront, PROJECT.ai, PROJECT.media, PROJECT.marketing];

type SceneProps = { time: number };

function ProjectsScene({ time }: SceneProps) {
  const { rootRef } = useSceneAnchors();
  const first = folderSlot(0);
  const second = folderSlot(1);
  const camera = keyframes<SceneCamera>(time, [
    [0, 400, 225, 1],
    [0.5, 400, 225, 1],
    [1.6, 300, 262, 1.32],
    [3.2, 300, 262, 1.32],
    [4.1, 500, 262, 1.32],
    [5.5, 500, 262, 1.32],
    [6.6, 400, 225, 1]
  ]);
  const [cursorX, cursorY] = keyframes<[number, number]>(time, [
    [0, 690, 410],
    [0.5, 690, 410],
    [1.45, first.x + 210, first.y + 172],
    [1.95, first.x + 210, first.y + 172],
    [2.45, first.x + 120, first.y + 16],
    [3.25, first.x + 120, first.y + 16],
    [4.05, second.x + 200, second.y + 172],
    [4.55, second.x + 200, second.y + 172],
    [5.0, second.x + 130, second.y + 64],
    [5.5, second.x + 130, second.y + 64],
    [6.6, 690, 410]
  ]);
  const firstFolder = folderState(time, [[1.3, 3.4]]);
  const secondFolder = folderState(time, [[3.85, 5.6]]);
  const firstSheetHover = tween(time, 2.38, 2.52) - tween(time, 3.2, 3.34);
  const secondSheetHover = tween(time, 4.92, 5.06) - tween(time, 5.45, 5.58);
  const animationOf = (index: number) => {
    if (index === 0) return { state: firstFolder, hoveredDepth: 2, hover: firstSheetHover };
    if (index === 1) return { state: secondFolder, hoveredDepth: 0, hover: secondSheetHover };
    return { state: SHUT_FOLDER };
  };

  return (
    <SceneCanvas ref={rootRef} camera={camera} veil={veilOpacity(time, 7.5)}>
      <ScenePage organization={ACME} count="4 projects">
        {ACME_PROJECTS.map((project, index) => (
          <SceneFolder key={project.name} {...folderSlot(index)} project={project} {...animationOf(index)} />
        ))}
      </ScenePage>
      <SceneCursor x={cursorX} y={cursorY} time={time} zoom={camera[2]} />
    </SceneCanvas>
  );
}

function NewProjectScene({ time }: SceneProps) {
  const { anchorAt, rootRef } = useSceneAnchors();
  const newProject = anchorAt("new-project", 548, 86);
  const description = anchorAt("project-description", 400, 262, 70);
  const create = anchorAt("create-project", 586, 372);
  const first = folderSlot(0);
  const camera = keyframes<SceneCamera>(time, [
    [0, 400, 225, 1],
    [0.35, 400, 225, 1],
    [1.15, 540, 140, 1.5],
    [1.45, 540, 140, 1.5],
    [2.0, 400, 225, 1.2],
    [5.55, 400, 225, 1.2],
    [6.3, 300, 262, 1.24],
    [7.85, 300, 262, 1.24],
    [8.5, 400, 225, 1]
  ]);
  const [cursorX, cursorY] = keyframes<[number, number]>(time, [
    [0, 600, 340],
    [0.35, 600, 340],
    [1.15, ...newProject],
    [1.5, ...newProject],
    [2.1, 660, 318],
    [3.3, 660, 318],
    [3.85, ...description],
    [4.1, ...description],
    [5.0, ...create],
    [5.6, ...create],
    [6.4, 640, 390],
    [6.9, first.x + 210, first.y + 172],
    [7.85, first.x + 210, first.y + 172],
    [8.5, 600, 340]
  ]);
  const modalOpenness = tween(time, 1.36, 1.62, EASE.ui) * (1 - tween(time, 5.55, 5.78, EASE.out));
  const name = typedText("checkout-api", time, 1.85, 2.95);
  const typedDescription = typedText("Payments API and its workers.", time, 4.05, 4.95);
  const isTyping = (time > 1.85 && time < 2.95) || (time > 4.05 && time < 4.95);
  const caret = isTyping ? 1 : caretOpacity(time);
  const shiftToNextSlot = tween(time, 5.7, 6.3, EASE.ui);
  const newFolderAppear = tween(time, 5.82, 6.3, EASE.ui);
  const newFolder = folderState(time, [[6.85, 7.85]]);
  const toastOpenness = tween(time, 5.88, 6.2, EASE.ui) * (1 - tween(time, 7.75, 8.0));

  return (
    <SceneCanvas ref={rootRef} camera={camera} veil={veilOpacity(time, 8.5)}>
      <ScenePage
        organization={ACME}
        count={time >= 5.7 ? "5 projects" : "4 projects"}
        newProjectHighlight={tween(time, 1.05, 1.15) * (1 - tween(time, 1.5, 1.62))}
        newProjectPress={pressAmount(time, 1.3)}
      >
        {ACME_PROJECTS.map((project, index) => {
          const from = folderSlot(index);
          const to = folderSlot(index + 1);
          return <SceneFolder key={project.name} x={mix(from.x, to.x, shiftToNextSlot)} y={mix(from.y, to.y, shiftToNextSlot)} project={project} />;
        })}
        {newFolderAppear > 0 && <SceneFolder {...first} project={PROJECT.checkout} appear={newFolderAppear} state={newFolder} ghost={newFolder.base} />}
      </ScenePage>
      <SceneModalLayer openness={modalOpenness}>
        <SceneModal
          openness={modalOpenness}
          width={460}
          title="New project"
          description="A project groups the deployments behind one app or service in Acme Corp."
          footer={
            <>
              <SceneButton kind="ghost">Cancel</SceneButton>
              <SceneButton kind="primary" anchor="create-project" hover={tween(time, 5.2, 5.3)} press={pressAmount(time, 5.45)} isDisabled={!name}>
                Create project
              </SceneButton>
            </>
          }
        >
          <SceneField
            label="Project name"
            value={name}
            placeholder="checkout-api"
            isFocused={time < 3.95}
            caret={caret}
            hint="Lowercase letters, numbers and hyphens."
          />
          <SceneField
            anchor="project-description"
            label="Description"
            isOptional
            value={typedDescription}
            placeholder="What lives in this project?"
            isFocused={time >= 3.95}
            caret={caret}
            rows={2}
          />
        </SceneModal>
      </SceneModalLayer>
      <SceneToast openness={toastOpenness} title="Created project checkout-api" />
      <SceneCursor x={cursorX} y={cursorY} time={time} clicks={[1.3, 3.95, 5.45]} zoom={camera[2]} />
    </SceneCanvas>
  );
}

function SwitcherScene({ time }: SceneProps) {
  const { anchorAt, rootRef } = useSceneAnchors();
  const switcher = anchorAt("switcher-chevron", 721, 28, -3, 1);
  const acmeRow = anchorAt("menu-acme", 590, 162, -40);
  const personalRow = anchorAt("menu-personal", 590, 100, -40);
  const camera = keyframes<SceneCamera>(time, [
    [0, 400, 225, 1],
    [0.3, 400, 225, 1],
    [1.1, 560, 150, 1.6],
    [2.6, 560, 150, 1.6],
    [3.4, 420, 250, 1.12],
    [4.5, 420, 250, 1.12],
    [5.15, 560, 150, 1.6],
    [6.25, 560, 150, 1.6],
    [7.1, 400, 225, 1]
  ]);
  const [cursorX, cursorY] = keyframes<[number, number]>(time, [
    [0, 520, 330],
    [0.3, 520, 330],
    [1.05, ...switcher],
    [1.3, ...switcher],
    [1.85, ...acmeRow],
    [2.5, ...acmeRow],
    [3.4, 470, 330],
    [4.5, 470, 330],
    [5.1, ...switcher],
    [5.35, ...switcher],
    [5.85, ...personalRow],
    [6.1, ...personalRow],
    [7.1, 520, 330]
  ]);
  const firstMenuOpenness = tween(time, 1.22, 1.38, EASE.ui) * (1 - tween(time, 2.47, 2.6, EASE.out));
  const secondMenuOpenness = tween(time, 5.27, 5.43, EASE.ui) * (1 - tween(time, 6.02, 6.15, EASE.out));
  const isInAcme = time >= 2.5 && time < 6.05;
  const acmeContent = tween(time, 2.5, 2.9, EASE.out) - tween(time, 6.05, 6.45, EASE.out);
  const hoveredRow = time > 1.75 && time < 2.55 ? 1 : time > 5.75 && time < 6.08 ? 0 : -1;
  const switcherPress = Math.max(pressAmount(time, 1.2), pressAmount(time, 5.25));

  return (
    <SceneCanvas ref={rootRef} camera={camera} veil={veilOpacity(time, 8)}>
      <ScenePage
        organization={isInAcme ? ACME : PERSONAL}
        count={isInAcme ? "4 projects" : "1 project"}
        switcherHighlight={Math.max(firstMenuOpenness, secondMenuOpenness, switcherPress)}
      >
        <div style={{ position: "absolute", inset: 0, opacity: 1 - acmeContent, transform: `translateY(${6 * acmeContent}px)` }}>
          <SceneFolder {...folderSlot(0)} project={PROJECT.playground} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: acmeContent,
            transform: `translateY(${6 * (1 - acmeContent)}px)`,
            visibility: acmeContent > 0.001 ? "visible" : "hidden"
          }}
        >
          {ACME_PROJECTS.map((project, index) => (
            <SceneFolder key={project.name} {...folderSlot(index)} project={project} />
          ))}
        </div>
      </ScenePage>
      <SceneOrganizationMenu
        openness={Math.max(firstMenuOpenness, secondMenuOpenness)}
        personal={PERSONAL}
        teams={TEAMS}
        currentId={time < 4 ? PERSONAL.id : ACME.id}
        hoveredRow={hoveredRow}
      />
      <SceneCursor x={cursorX} y={cursorY} time={time} clicks={[1.2, 2.45, 5.25, 6.0]} zoom={camera[2]} />
    </SceneCanvas>
  );
}

function CreateOrganizationScene({ time }: SceneProps) {
  const { anchorAt, rootRef } = useSceneAnchors();
  const switcher = anchorAt("switcher-chevron", 721, 28, -3, 1);
  const createRow = anchorAt("menu-create", 590, 245, -50);
  const invite = anchorAt("invite-teammates", 400, 262, 120);
  const create = anchorAt("create-organization", 556, 392);
  const camera = keyframes<SceneCamera>(time, [
    [0, 400, 225, 1],
    [0.3, 400, 225, 1],
    [1.0, 560, 150, 1.6],
    [2.15, 560, 150, 1.6],
    [2.75, 400, 225, 1.14],
    [6.3, 400, 225, 1.14],
    [7.0, 470, 190, 1.2],
    [7.95, 470, 190, 1.2],
    [8.55, 560, 150, 1.6],
    [9.35, 560, 150, 1.6],
    [10, 400, 225, 1]
  ]);
  const [cursorX, cursorY] = keyframes<[number, number]>(time, [
    [0, 520, 330],
    [0.3, 520, 330],
    [0.95, ...switcher],
    [1.2, ...switcher],
    [1.8, ...createRow],
    [2.15, ...createRow],
    [2.8, 690, 330],
    [3.45, 690, 330],
    [3.75, ...invite],
    [3.95, ...invite],
    [4.4, 690, 330],
    [5.6, 690, 330],
    [6.0, ...create],
    [6.25, ...create],
    [7.0, 610, 390],
    [9.35, 610, 390],
    [10, 520, 330]
  ]);
  const menuOpenness = tween(time, 1.1, 1.26, EASE.ui) * (1 - tween(time, 2.07, 2.18, EASE.out));
  const modalOpenness = tween(time, 2.2, 2.46, EASE.ui) * (1 - tween(time, 6.25, 6.48, EASE.out));
  const name = typedText("Harborline", time, 2.6, 3.35);
  const firstEmail = "priya@harborline.io";
  const secondEmail = "dev@harborline.io";
  const typedEmail = typedEmailAt(time, firstEmail, secondEmail);
  const chips: [string, number][] = [
    [firstEmail, tween(time, 4.78, 5.0, EASE.back)],
    [secondEmail, tween(time, 5.63, 5.85, EASE.back)]
  ];
  const isTyping = (time > 2.6 && time < 3.35) || (time > 3.95 && time < 5.6);
  const caret = isTyping ? 1 : caretOpacity(time);
  const isCreated = time >= 6.3;
  const swapToEmptyOrganization = tween(time, 6.3, 6.7, EASE.out);
  const toastOpenness = tween(time, 6.45, 6.77, EASE.ui) * (1 - tween(time, 7.8, 8.05));

  return (
    <SceneCanvas ref={rootRef} camera={camera} veil={veilOpacity(time, 10)}>
      <ScenePage
        organization={isCreated ? HARBORLINE : PERSONAL}
        count={isCreated ? undefined : "1 project"}
        hasNewDeployment={!isCreated}
        switcherHighlight={Math.max(menuOpenness, pressAmount(time, 1.08))}
      >
        <div style={{ position: "absolute", inset: 0, opacity: 1 - swapToEmptyOrganization }}>
          <SceneFolder {...folderSlot(0)} project={PROJECT.playground} />
        </div>
        {swapToEmptyOrganization > 0 && <SceneEmptyProjects organization={HARBORLINE} appear={swapToEmptyOrganization} />}
      </ScenePage>
      <SceneOrganizationMenu
        openness={menuOpenness}
        personal={PERSONAL}
        teams={TEAMS}
        currentId={PERSONAL.id}
        hoveredRow={time > 1.7 && time < 2.15 ? TEAMS.length + 1 : -1}
      />
      <SceneModalLayer openness={modalOpenness}>
        <SceneModal
          openness={modalOpenness}
          width={520}
          title="Create an organization"
          description="Share projects, deployments and billing with your team."
          footer={
            <>
              <SceneButton kind="ghost">Cancel</SceneButton>
              <SceneButton kind="primary" anchor="create-organization" hover={tween(time, 5.9, 6.0)} press={pressAmount(time, 6.15)} isDisabled={!name}>
                Create organization
              </SceneButton>
            </>
          }
        >
          <SceneField label="Organization name" value={name} placeholder="Acme Corp" isFocused={time < 3.85} caret={caret} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <SceneFieldLabel isOptional>Invite teammates</SceneFieldLabel>
            <SceneChips anchor="invite-teammates" chips={chips} typing={typedEmail} isFocused={time >= 3.85} caret={caret} />
            <span style={{ fontSize: 12, color: COLOR.mutedForeground }}>They join as Members. You can change roles later.</span>
          </div>
          <SceneInfoNote>You’ll be the organization’s owner.</SceneInfoNote>
        </SceneModal>
      </SceneModalLayer>
      <SceneToast openness={toastOpenness} title="Created Harborline" description="Invites sent to 2 people." />
      <SceneCursor x={cursorX} y={cursorY} time={time} clicks={[1.08, 2.05, 3.85, 6.15]} zoom={camera[2]} />
    </SceneCanvas>
  );
}

function typedEmailAt(time: number, firstEmail: string, secondEmail: string) {
  if (time < 4.8) return typedText(firstEmail, time, 3.95, 4.7);
  if (time < 4.95) return "";
  if (time < 5.65) return typedText(secondEmail, time, 4.95, 5.55);
  return "";
}

export type SceneId = "projects" | "newProject" | "switcher" | "createOrganization";

/** `posterAt` is the frame shown instead of the animation when motion is reduced. */
export const SCENES: Record<SceneId, { Scene: ComponentType<SceneProps>; durationSeconds: number; posterAt: number }> = {
  projects: { Scene: ProjectsScene, durationSeconds: 7.5, posterAt: 2.9 },
  newProject: { Scene: NewProjectScene, durationSeconds: 8.5, posterAt: 4.7 },
  switcher: { Scene: SwitcherScene, durationSeconds: 8, posterAt: 2.1 },
  createOrganization: { Scene: CreateOrganizationScene, durationSeconds: 10, posterAt: 5.9 }
};
