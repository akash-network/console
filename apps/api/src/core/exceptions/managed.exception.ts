type ManagedExceptionData = Record<string, unknown>;

export class ManagedException extends Error {
  readonly data: ManagedExceptionData;
  constructor(message?: string, data?: ManagedExceptionData) {
    super(message);
    this.name = this.constructor.name;
    this.data = data;
  }
}
