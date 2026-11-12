import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, HardwareSection } from "./HardwareSection";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

type UnlockingCards = {
  GpuCard: Mock<typeof DEPENDENCIES.GpuCard>;
  PresetsCard: Mock<typeof DEPENDENCIES.PresetsCard>;
  SecurityCard: Mock<typeof DEPENDENCIES.SecurityCard>;
  TrialResourceLimitHint: Mock<typeof DEPENDENCIES.TrialResourceLimitHint>;
};

describe(HardwareSection.name, () => {
  it("renders each hardware row for the selected service", () => {
    const PresetsCard = vi.fn(() => null);
    const GpuCard = vi.fn(() => null);
    const ComputeResourcesCard = vi.fn(() => null);
    const PersistentStorageCard = vi.fn(() => null);
    const RamStorageCard = vi.fn(() => null);
    const SecurityCard = vi.fn(() => null);

    setup({
      serviceIndex: 2,
      dependencies: { PresetsCard, GpuCard, ComputeResourcesCard, PersistentStorageCard, RamStorageCard, SecurityCard }
    });

    expect(PresetsCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(GpuCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(ComputeResourcesCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(PersistentStorageCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(RamStorageCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(SecurityCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
  });

  it("forwards the locked state to every hardware card", () => {
    const PresetsCard = vi.fn(() => null);
    const GpuCard = vi.fn(() => null);
    const ComputeResourcesCard = vi.fn(() => null);
    const PersistentStorageCard = vi.fn(() => null);
    const RamStorageCard = vi.fn(() => null);
    const SecurityCard = vi.fn(() => null);

    setup({ locked: true, dependencies: { PresetsCard, GpuCard, ComputeResourcesCard, PersistentStorageCard, RamStorageCard, SecurityCard } });

    expect(PresetsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(GpuCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(ComputeResourcesCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(PersistentStorageCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(RamStorageCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(SecurityCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
  });

  it("stacks the presets, GPU, compute, confidential compute, RAM storage and persistent storage cards in that order", () => {
    const CollapsibleCard = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof DEPENDENCIES.CollapsibleCard>>(({ title, children }, _ref) => (
      <section aria-label={title}>{children}</section>
    ));

    setup({
      dependencies: {
        CollapsibleCard,
        GpuCard: () => <section aria-label="GPU" />,
        SecurityCard: () => <section aria-label="Confidential compute" />,
        RamStorageCard: () => <section aria-label="RAM storage" />,
        PersistentStorageCard: () => <section aria-label="Persistent storage" />
      }
    });

    expect(screen.getAllByRole("region").map(card => card.getAttribute("aria-label"))).toEqual([
      "Presets",
      "GPU",
      "Compute",
      "Confidential compute",
      "RAM storage",
      "Persistent storage"
    ]);
  });

  it("passes an isBlockedModel predicate and unlock handler to the GPU cards", () => {
    const PresetsCard = vi.fn(() => null);
    const GpuCard = vi.fn(() => null);
    const useTrialGate = () => ({ isRestricted: true, isWalletReady: true });

    setup({ dependencies: { PresetsCard, GpuCard, useTrialGate } });

    expect(PresetsCard).toHaveBeenCalledWith(
      expect.objectContaining({ isBlockedModel: expect.any(Function), onUnlock: expect.any(Function) }),
      expect.anything()
    );
    expect(GpuCard).toHaveBeenCalledWith(expect.objectContaining({ isBlockedModel: expect.any(Function), onUnlock: expect.any(Function) }), expect.anything());
  });

  it("passes isGpuBlocked and an unlock handler to the security card for a trial", () => {
    const SecurityCard = vi.fn(() => null);
    const useTrialGate = () => ({ isRestricted: true, isWalletReady: true });

    setup({ dependencies: { SecurityCard, useTrialGate } });

    expect(SecurityCard).toHaveBeenCalledWith(expect.objectContaining({ isGpuBlocked: true, onUnlock: expect.any(Function) }), expect.anything());
  });

  it("does not block the security card when the trial restriction is not in force", () => {
    const SecurityCard = vi.fn(() => null);
    const useTrialGate = () => ({ isRestricted: false, isWalletReady: true });

    setup({ dependencies: { SecurityCard, useTrialGate } });

    expect(SecurityCard).toHaveBeenCalledWith(expect.objectContaining({ isGpuBlocked: false }), expect.anything());
  });

  it("does not block the security card while the pane is locked so the trial warning never fights the read-only quote view", () => {
    const SecurityCard = vi.fn(() => null);
    const useTrialGate = () => ({ isRestricted: true, isWalletReady: true });

    setup({ locked: true, dependencies: { SecurityCard, useTrialGate } });

    expect(SecurityCard).toHaveBeenCalledWith(expect.objectContaining({ isGpuBlocked: false }), expect.anything());
  });

  it("blocks the GPU interconnect in the GPU card for a trial", () => {
    const GpuCard = vi.fn(() => null);
    const useTrialGate = () => ({ isRestricted: true, isWalletReady: true });

    setup({ dependencies: { GpuCard, useTrialGate } });

    expect(GpuCard).toHaveBeenCalledWith(expect.objectContaining({ isInterconnectTrialBlocked: true, onUnlock: expect.any(Function) }), expect.anything());
  });

  it("does not block the GPU interconnect when the trial restriction is not in force", () => {
    const GpuCard = vi.fn(() => null);
    const useTrialGate = () => ({ isRestricted: false, isWalletReady: true });

    setup({ dependencies: { GpuCard, useTrialGate } });

    expect(GpuCard).toHaveBeenCalledWith(expect.objectContaining({ isInterconnectTrialBlocked: false }), expect.anything());
  });

  it("does not block the GPU interconnect while the pane is locked so the trial warning never fights the read-only quote view", () => {
    const GpuCard = vi.fn(() => null);
    const useTrialGate = () => ({ isRestricted: true, isWalletReady: true });

    setup({ locked: true, dependencies: { GpuCard, useTrialGate } });

    expect(GpuCard).toHaveBeenCalledWith(expect.objectContaining({ isInterconnectTrialBlocked: false }), expect.anything());
  });

  it("blocks nothing while the pane is locked", () => {
    const GpuCard = vi.fn<typeof DEPENDENCIES.GpuCard>(() => null);
    const useTrialGate = () => ({ isRestricted: true, isWalletReady: true });

    setup({ locked: true, dependencies: { GpuCard, useTrialGate } });

    const { isBlockedModel } = GpuCard.mock.calls.at(-1)![0];
    expect(isBlockedModel?.("nvidia", "h100")).toBe(false);
  });

  it("blocks nothing when the trial restriction is not in force", () => {
    const GpuCard = vi.fn<typeof DEPENDENCIES.GpuCard>(() => null);
    const useTrialGate = () => ({ isRestricted: false, isWalletReady: true });

    setup({ dependencies: { GpuCard, useTrialGate } });

    const { isBlockedModel } = GpuCard.mock.calls.at(-1)![0];
    expect(isBlockedModel?.("nvidia", "h100")).toBe(false);
  });

  it.each([
    {
      unlock: "a blocked GPU",
      context: "configure_unlock_gpu",
      description:
        "High-end GPUs aren't covered by your free trial. Add credits to run this deployment on one, along with longer runtimes and the full Console.",
      requestUnlock: (cards: UnlockingCards) => cards.GpuCard.mock.calls.at(-1)![0].onUnlock?.()
    },
    {
      unlock: "the GPU interconnect",
      context: "configure_unlock_gpu_interconnect",
      description:
        "GPU interconnect isn't covered by your free trial. Add credits to use it in this deployment, along with longer runtimes and the full Console.",
      requestUnlock: (cards: UnlockingCards) => cards.GpuCard.mock.calls.at(-1)![0].onUnlockInterconnect?.()
    },
    {
      unlock: "a blocked preset",
      context: "configure_unlock_preset",
      description:
        "Presets with high-end GPUs aren't covered by your free trial. Add credits to use any preset for this deployment, along with longer runtimes and the full Console.",
      requestUnlock: (cards: UnlockingCards) => cards.PresetsCard.mock.calls.at(-1)![0].onUnlock?.()
    },
    {
      unlock: "GPU confidential compute",
      context: "configure_unlock_confidential_gpu",
      description:
        "Confidential compute on a GPU isn't covered by your free trial. Add credits to attest a GPU in this deployment, along with longer runtimes and the full Console.",
      requestUnlock: (cards: UnlockingCards) => cards.SecurityCard.mock.calls.at(-1)![0].onUnlock?.()
    },
    {
      unlock: "the trial size cap",
      context: "configure_unlock_size_limit",
      description:
        "This deployment needs more CPU or memory than your free trial allows. Add credits to deploy it at this size, along with longer runtimes and the full Console.",
      requestUnlock: (cards: UnlockingCards) => cards.TrialResourceLimitHint.mock.calls.at(-1)![0].onUnlock?.()
    }
  ])("opens add credits explaining $unlock and records it as $context", ({ context, description, requestUnlock }) => {
    const cards = {
      GpuCard: vi.fn<typeof DEPENDENCIES.GpuCard>(() => null),
      PresetsCard: vi.fn<typeof DEPENDENCIES.PresetsCard>(() => null),
      SecurityCard: vi.fn<typeof DEPENDENCIES.SecurityCard>(() => null),
      TrialResourceLimitHint: vi.fn<typeof DEPENDENCIES.TrialResourceLimitHint>(() => null)
    };
    const useTrialGate = () => ({ isRestricted: true, isWalletReady: true });
    const { openAddCredits } = setup({ dependencies: { ...cards, useTrialGate } });

    requestUnlock(cards);

    expect(openAddCredits).toHaveBeenCalledExactlyOnceWith({ initialTab: "purchase", suggestFirstDeployment: false, context, description });
  });

  it("states the trial size cap with an unlock handler while the pane is editable", () => {
    const TrialResourceLimitHint = vi.fn(() => null);

    setup({ dependencies: { TrialResourceLimitHint } });

    expect(TrialResourceLimitHint).toHaveBeenCalledWith({ onUnlock: expect.any(Function) }, expect.anything());
  });

  it("leaves the trial size cap out of the read-only quote view", () => {
    const TrialResourceLimitHint = vi.fn(() => null);

    setup({ locked: true, dependencies: { TrialResourceLimitHint } });

    expect(TrialResourceLimitHint).not.toHaveBeenCalled();
  });

  it("leaves the trial size cap to another view of the deployment", () => {
    const TrialResourceLimitHint = vi.fn(() => null);

    setup({ showsDeploymentLimit: false, dependencies: { TrialResourceLimitHint } });

    expect(TrialResourceLimitHint).not.toHaveBeenCalled();
  });

  it("offers the trial gpu alternatives to a restricted account while the pane is editable", () => {
    const TrialGpuBlockHint = vi.fn(() => null);
    const useTrialGate = () => ({ isRestricted: true, isWalletReady: true });

    setup({ dependencies: { TrialGpuBlockHint, useTrialGate } });

    expect(TrialGpuBlockHint).toHaveBeenCalled();
  });

  it.each([
    { case: "an unrestricted account", isRestricted: false },
    { case: "the read-only quote view", isRestricted: true, locked: true },
    { case: "another view of the deployment", isRestricted: true, showsDeploymentLimit: false }
  ])("leaves the trial gpu alternatives out of $case", ({ isRestricted, locked, showsDeploymentLimit }) => {
    const TrialGpuBlockHint = vi.fn(() => null);
    const useTrialGate = () => ({ isRestricted, isWalletReady: true });

    setup({ locked, showsDeploymentLimit, dependencies: { TrialGpuBlockHint, useTrialGate } });

    expect(TrialGpuBlockHint).not.toHaveBeenCalled();
  });

  function setup(input: { serviceIndex?: number; locked?: boolean; showsDeploymentLimit?: boolean; dependencies?: Partial<typeof DEPENDENCIES> }) {
    const openAddCredits = vi.fn();
    const dependencies = MockComponents(DEPENDENCIES, {
      useTrialGate: () => ({ isRestricted: false, isWalletReady: false }),
      useAddCredits: () => openAddCredits,
      ...input.dependencies
    });
    render(
      <HardwareSection
        serviceIndex={input.serviceIndex ?? 0}
        locked={input.locked}
        showsDeploymentLimit={input.showsDeploymentLimit}
        dependencies={dependencies}
      />
    );

    return { openAddCredits };
  }
});
