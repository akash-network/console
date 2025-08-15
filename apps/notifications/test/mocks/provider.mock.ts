import type { InjectionToken, Provider } from "@nestjs/common";
import { mock } from "jest-mock-extended";

export const MockProvider = <T>(token: InjectionToken<T>, override?: DeepPartial<T>): Provider => {
  return { provide: token, useValue: mock<T>(override as Parameters<typeof mock<T>>[0]) };
};

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
