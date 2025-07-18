import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";
import type { InjectionToken } from "tsyringe";
import { container } from "tsyringe";

export function mockProvider<T extends object>(service: InjectionToken<T> | (new (...args: any[]) => T)): MockProxy<T> {
  const value = mock<T>();
  container.register(service, { useValue: value });

  return value;
}
