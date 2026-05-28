const UNLIMITED = -1n;
export const MAX_INT64 = 9223372036854775807n;

export class ResourcePair {
  #allocatable: bigint;
  #allocated: bigint;

  constructor(allocatable: bigint, allocated: bigint) {
    this.#allocatable = allocatable;
    this.#allocated = allocated;
  }

  available(): bigint {
    if (this.#allocatable === UNLIMITED) return MAX_INT64;
    const diff = this.#allocatable - this.#allocated;
    return diff > 0n ? diff : 0n;
  }

  canAllocate(val: bigint): boolean {
    return this.#allocatable === UNLIMITED || this.#allocatable - this.#allocated >= val;
  }

  canAllocateWithDelta(val: bigint, delta: bigint): boolean {
    if (this.#allocatable === UNLIMITED) return true;
    return this.#allocatable - this.#allocated - delta >= val;
  }

  allocate(val: bigint): boolean {
    if (!this.canAllocate(val)) return false;
    this.#allocated += val;
    return true;
  }

  get allocatable(): bigint {
    return this.#allocatable;
  }

  get allocated(): bigint {
    return this.#allocated;
  }

  clone(): ResourcePair {
    return new ResourcePair(this.#allocatable, this.#allocated);
  }

  toJSON(): ResourcePairState {
    return { allocatable: this.#allocatable, allocated: this.#allocated };
  }
}

export interface ResourcePairState {
  allocatable: bigint;
  allocated: bigint;
}
