import { ManagedException } from "@src/core/exceptions/managed.exception";

export class NotFoundException extends ManagedException {
  static assert(condition: unknown): void {
    if (!condition) {
      throw new NotFoundException();
    }
  }
}
