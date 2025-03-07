/// <reference types="jest" />

declare namespace jest {
  interface Expect<R> {
    toBeTypeOrNull(type: StringConstructor): R;
    dateTimeZ(): R;
  }
}
