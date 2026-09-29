import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, HardwareSection } from "./HardwareSection";

import { act, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

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

  it("opens the AddCreditsSheet when a card requests unlock", () => {
    const AddCreditsSheet = vi.fn(() => <div />);
    let requestUnlock: () => void = () => {};
    const GpuCard = vi.fn<typeof DEPENDENCIES.GpuCard>(props => {
      requestUnlock = props.onUnlock ?? (() => {});
      return null;
    });
    const useTrialGate = () => ({ isRestricted: true, isWalletReady: true });

    setup({ dependencies: { GpuCard, AddCreditsSheet, useTrialGate } });

    expect(AddCreditsSheet).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }), expect.anything());

    act(() => requestUnlock());

    expect(AddCreditsSheet).toHaveBeenLastCalledWith(expect.objectContaining({ open: true }), expect.anything());
  });

  function setup(input: { serviceIndex?: number; locked?: boolean; dependencies?: Partial<typeof DEPENDENCIES> }) {
    const dependencies = MockComponents(DEPENDENCIES, {
      useTrialGate: () => ({ isRestricted: false, isWalletReady: false }),
      ...input.dependencies
    });
    render(<HardwareSection serviceIndex={input.serviceIndex ?? 0} locked={input.locked} dependencies={dependencies} />);
  }
});
