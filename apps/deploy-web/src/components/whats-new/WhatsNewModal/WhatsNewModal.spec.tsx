import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { organizationsRelease } from "../organizationsRelease";
import type { DEPENDENCIES } from "./WhatsNewModal";
import { WhatsNewModal } from "./WhatsNewModal";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const FIRST_TITLE = "Your deployments now live in projects";
const SECOND_TITLE = "Start a project for each app";
const LAST_TITLE = "Bring your team with organizations";

describe(WhatsNewModal.name, () => {
  it("shows nothing while closed", () => {
    setup({ isOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on the first slide, titled and described by its copy", () => {
    setup();

    const dialog = screen.getByRole("dialog", { name: FIRST_TITLE });
    expect(dialog).toHaveAccessibleDescription(
      "A project groups the deployments behind one app or service. Hover a folder on the Projects page to see what’s running inside."
    );
    expect(screen.getByText("Organizations & Projects")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("plays the slide's scene at the clock's time, sized to the stage", () => {
    const { WhatsNewScene } = setup({ elapsedBySlide: [2] });

    expect(WhatsNewScene.mock.lastCall?.[0]).toEqual({ sceneId: "projects", time: 2, width: 640, height: 360 });
  });

  it("does not draw the scene before the stage has a width", () => {
    const { WhatsNewScene } = setup({ stageWidth: 0 });

    expect(WhatsNewScene).not.toHaveBeenCalled();
  });

  it("runs the clock per slide, restarting it on each one", async () => {
    const { useSceneClock } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Next slide" }));

    expect(useSceneClock).toHaveBeenCalledWith(true, "0");
    expect(useSceneClock).toHaveBeenLastCalledWith(true, "1");
  });

  it("pages through the slides with the previous and next buttons", async () => {
    setup();
    expect(screen.getByRole("button", { name: "Previous slide" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(screen.getByRole("dialog", { name: SECOND_TITLE })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(screen.getByRole("dialog", { name: FIRST_TITLE })).toBeInTheDocument();
  });

  it("stops at the last slide", async () => {
    setup();

    await clickNextSlide(3);

    expect(screen.getByRole("dialog", { name: LAST_TITLE })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next slide" })).toBeDisabled();
  });

  it("pages through the slides with the arrow keys and ignores other keys", async () => {
    setup();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("dialog", { name: SECOND_TITLE })).toBeInTheDocument();

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("dialog", { name: SECOND_TITLE })).toBeInTheDocument();

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("dialog", { name: FIRST_TITLE })).toBeInTheDocument();
  });

  it("does not page past either end with the arrow keys", async () => {
    setup();

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("dialog", { name: FIRST_TITLE })).toBeInTheDocument();

    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("dialog", { name: LAST_TITLE })).toBeInTheDocument();
  });

  it("moves on once the slide's scene has played through", () => {
    setup({ elapsedBySlide: [7.5] });

    expect(screen.getByRole("dialog", { name: SECOND_TITLE })).toBeInTheDocument();
  });

  it("stays on a slide whose scene is still playing", () => {
    setup({ elapsedBySlide: [7.49] });

    expect(screen.getByRole("dialog", { name: FIRST_TITLE })).toBeInTheDocument();
  });

  it("holds a finished scene on its last frame while moving on", () => {
    const { WhatsNewScene } = setup({ elapsedBySlide: [9] });

    expect(WhatsNewScene.mock.calls.map(([props]) => props)).toContainEqual(expect.objectContaining({ sceneId: "projects", time: 7.5 }));
  });

  it("loops the last slide's scene instead of moving on", async () => {
    const { WhatsNewScene } = setup({ elapsedBySlide: [0, 0, 0, 12] });

    await clickNextSlide(3);

    expect(screen.getByRole("dialog", { name: LAST_TITLE })).toBeInTheDocument();
    expect(WhatsNewScene.mock.lastCall?.[0]).toMatchObject({ sceneId: "createOrganization", time: 2 });
  });

  it("pauses the scene while the pointer rests on it", () => {
    const { useSceneClock } = setup();

    fireEvent.mouseEnter(screen.getByText("Scene projects"));
    expect(useSceneClock).toHaveBeenLastCalledWith(false, "0");

    fireEvent.mouseLeave(screen.getByText("Scene projects"));
    expect(useSceneClock).toHaveBeenLastCalledWith(true, "0");
  });

  it("pauses and resumes the slideshow from its button", async () => {
    const { useSceneClock } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Pause slideshow" }));
    expect(useSceneClock).toHaveBeenLastCalledWith(false, "0");

    await userEvent.click(screen.getByRole("button", { name: "Play slideshow" }));
    expect(useSceneClock).toHaveBeenLastCalledWith(true, "0");
  });

  it("holds a paused scene on the frame it reached", async () => {
    const { WhatsNewScene } = setup({ elapsedBySlide: [2] });

    await userEvent.click(screen.getByRole("button", { name: "Pause slideshow" }));

    expect(WhatsNewScene.mock.lastCall?.[0]).toMatchObject({ sceneId: "projects", time: 2 });
  });

  it("shows the poster frame of a slide reached while paused", async () => {
    const { WhatsNewScene, useSceneClock } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Pause slideshow" }));
    await clickNextSlide(1);

    expect(useSceneClock).toHaveBeenLastCalledWith(false, "1");
    expect(WhatsNewScene.mock.lastCall?.[0]).toMatchObject({ sceneId: "newProject", time: 4.7 });
  });

  describe("when motion is reduced", () => {
    it("shows each scene's poster frame with the clock stopped", () => {
      const { WhatsNewScene, useSceneClock } = setup({ prefersReducedMotion: true });

      expect(useSceneClock).toHaveBeenLastCalledWith(false, "0");
      expect(WhatsNewScene.mock.lastCall?.[0]).toMatchObject({ sceneId: "projects", time: 2.9 });
    });

    it("offers no pause button, since nothing plays", () => {
      setup({ prefersReducedMotion: true });

      expect(screen.queryByRole("button", { name: "Pause slideshow" })).not.toBeInTheDocument();
    });

    it("leaves moving on to the reader", () => {
      setup({ prefersReducedMotion: true, elapsedBySlide: [100] });

      expect(screen.getByRole("dialog", { name: FIRST_TITLE })).toBeInTheDocument();
    });
  });

  it.each(["Maybe later", "Close"])("closes when %s is chosen", async name => {
    const { onClose } = setup();

    await userEvent.click(screen.getByRole("button", { name }));

    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const { onClose } = setup();

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("hands the card's box to the tour when Try it now is chosen", async () => {
    const { onTryIt } = setup();
    vi.spyOn(screen.getByRole("dialog"), "getBoundingClientRect").mockReturnValue(mock<DOMRect>({ left: 10, top: 20, width: 300, height: 400 }));

    await userEvent.click(screen.getByRole("button", { name: "Try it now" }));

    expect(onTryIt).toHaveBeenCalledWith({ x: 10, y: 20, width: 300, height: 400 });
  });

  async function clickNextSlide(times: number) {
    for (let click = 0; click < times; click++) {
      await userEvent.click(screen.getByRole("button", { name: "Next slide" }));
    }
  }

  function setup(input: { isOpen?: boolean; elapsedBySlide?: number[]; stageWidth?: number; prefersReducedMotion?: boolean } = {}) {
    const onClose = vi.fn();
    const onTryIt = vi.fn();
    const useSceneClock = vi.fn<typeof DEPENDENCIES.useSceneClock>((_isRunning, restartKey) => input.elapsedBySlide?.[Number(restartKey)] ?? 0);
    const WhatsNewScene = vi.fn<typeof DEPENDENCIES.WhatsNewScene>(({ sceneId }) => <span>Scene {sceneId}</span>);
    const dependencies: typeof DEPENDENCIES = {
      useMediaQuery: query => query === "(prefers-reduced-motion: reduce)" && !!input.prefersReducedMotion,
      useSceneClock,
      useElementWidth: () => ({ measureRef: vi.fn(), width: input.stageWidth ?? 640 }),
      WhatsNewScene
    };
    const release = organizationsRelease({ canManageProjects: true, showProjects: vi.fn() });

    render(
      <WhatsNewModal
        release={release}
        isOpen={input.isOpen ?? true}
        isHandingOffToTour={false}
        onClose={onClose}
        onTryIt={onTryIt}
        dependencies={dependencies}
      />
    );

    return { onClose, onTryIt, useSceneClock, WhatsNewScene };
  }
});
