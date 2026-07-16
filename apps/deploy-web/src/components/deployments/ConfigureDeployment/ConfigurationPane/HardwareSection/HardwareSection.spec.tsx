import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { DEPENDENCIES, HardwareSection } from "./HardwareSection";

import { act, render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

type OpenFn = ReturnType<typeof DEPENDENCIES.useBillingSheet>["open"];

describe(HardwareSection.name, () => {
  it("renders each hardware row for the selected service", () => {
    const PresetsCard = vi.fn(() => null);
    const GpuCard = vi.fn(() => null);
    const ComputeResourcesCard = vi.fn(() => null);
    const PersistentStorageCard = vi.fn(() => null);
    const RamStorageCard = vi.fn(() => null);
    const ConfidentialComputeCard = vi.fn(() => null);

    setup({ serviceIndex: 2, dependencies: { PresetsCard, GpuCard, ComputeResourcesCard, PersistentStorageCard, RamStorageCard, ConfidentialComputeCard } });

    expect(PresetsCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(GpuCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(ComputeResourcesCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(PersistentStorageCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(RamStorageCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(ConfidentialComputeCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
  });

  it("forwards the locked state to every hardware card", () => {
    const PresetsCard = vi.fn(() => null);
    const GpuCard = vi.fn(() => null);
    const ComputeResourcesCard = vi.fn(() => null);
    const PersistentStorageCard = vi.fn(() => null);
    const RamStorageCard = vi.fn(() => null);

    setup({ locked: true, dependencies: { PresetsCard, GpuCard, ComputeResourcesCard, PersistentStorageCard, RamStorageCard } });

    expect(PresetsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(GpuCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(ComputeResourcesCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(PersistentStorageCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(RamStorageCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
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

  it("passes isGpuBlocked and an unlock handler to the confidential compute card for a trial", () => {
    const ConfidentialComputeCard = vi.fn(() => null);
    const useTrialGate = () => ({ isRestricted: true, isWalletReady: true });

    setup({ dependencies: { ConfidentialComputeCard, useTrialGate } });

    expect(ConfidentialComputeCard).toHaveBeenCalledWith(expect.objectContaining({ isGpuBlocked: true, onUnlock: expect.any(Function) }), expect.anything());
  });

  it("does not block the confidential compute card when the trial restriction is not in force", () => {
    const ConfidentialComputeCard = vi.fn(() => null);
    const useTrialGate = () => ({ isRestricted: false, isWalletReady: true });

    setup({ dependencies: { ConfidentialComputeCard, useTrialGate } });

    expect(ConfidentialComputeCard).toHaveBeenCalledWith(expect.objectContaining({ isGpuBlocked: false }), expect.anything());
  });

  it("does not block the confidential compute card while the pane is locked so the trial warning never fights the read-only quote view", () => {
    const ConfidentialComputeCard = vi.fn(() => null);
    const useTrialGate = () => ({ isRestricted: true, isWalletReady: true });

    setup({ locked: true, dependencies: { ConfidentialComputeCard, useTrialGate } });

    expect(ConfidentialComputeCard).toHaveBeenCalledWith(expect.objectContaining({ isGpuBlocked: false }), expect.anything());
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

  it("opens the billing sheet when a card requests unlock", () => {
    const open = vi.fn<OpenFn>();
    let requestUnlock: () => void = () => {};
    const GpuCard = vi.fn<typeof DEPENDENCIES.GpuCard>(props => {
      requestUnlock = props.onUnlock ?? (() => {});
      return null;
    });
    const useTrialGate = () => ({ isRestricted: true, isWalletReady: true });

    setup({ open, dependencies: { GpuCard, useTrialGate } });

    expect(open).not.toHaveBeenCalled();

    act(() => requestUnlock());

    expect(open).toHaveBeenCalledTimes(1);
  });

  function setup(input: { serviceIndex?: number; locked?: boolean; open?: OpenFn; dependencies?: Partial<typeof DEPENDENCIES> }) {
    const open = input.open ?? vi.fn();
    const useBillingSheet: typeof DEPENDENCIES.useBillingSheet = () => mock<ReturnType<typeof DEPENDENCIES.useBillingSheet>>({ open });
    const dependencies = MockComponents(DEPENDENCIES, {
      useTrialGate: () => ({ isRestricted: false, isWalletReady: false }),
      useBillingSheet,
      ...input.dependencies
    });
    render(<HardwareSection serviceIndex={input.serviceIndex ?? 0} locked={input.locked} dependencies={dependencies} />);
  }
});
