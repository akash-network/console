import { ManagedException } from "@src/core/exceptions/managed.exception";

export class InternalServerException extends ManagedException {
  static assert(condition: unknown): void {
    if (!condition) {
      throw new InternalServerException();
    }
  }
}
