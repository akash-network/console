import type { ResourcePairState } from "../types/inventory.types";

const UNLIMITED = -1n;
export const MAX_INT64 = 9223372036854775807n;

export class ResourcePair {
  private allocatable: bigint;
  private allocated: bigint;

  constructor(allocatable: bigint, allocated: bigint) {
    this.allocatable = allocatable;
    this.allocated = allocated;
  }

  available(): bigint {
    if (this.allocatable === UNLIMITED) return MAX_INT64;
    const diff = this.allocatable - this.allocated;
    return diff > 0n ? diff : 0n;
  }

  canAllocate(val: bigint): boolean {
    return this.allocatable === UNLIMITED || this.allocatable - this.allocated >= val;
  }

  allocate(val: bigint): boolean {
    if (!this.canAllocate(val)) return false;
    this.allocated += val;
    return true;
  }

  toState(): ResourcePairState {
    return {
      allocatable: this.allocatable,
      allocated: this.allocated
    };
  }

  clone(): ResourcePair {
    return new ResourcePair(this.allocatable, this.allocated);
  }

  static fromState(state: ResourcePairState): ResourcePair {
    return new ResourcePair(state.allocatable, state.allocated);
  }
}
