import type { InjectionToken } from "tsyringe";
import { container } from "tsyringe";
import type { MockProxy } from "vitest-mock-extended";
import { mock } from "vitest-mock-extended";

export function mockProvider<T extends object>(service: InjectionToken<T> | (new (...args: any[]) => T)): MockProxy<T> {
  const value = mock<T>();
  container.register(service, { useValue: value });

  return value;
}
