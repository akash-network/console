import { type FC, forwardRef } from "react";
import { type MockedFunction, vi } from "vitest";

/**
 * Dump component that just renders children in React.Fragment
 */
export function ComponentMock(props: Record<string, any>) {
  return <>{props.children}</>;
}

export const createRefComponentMock = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderFn = vi.fn((props: Record<string, any>, _ref: unknown) => {
    return <>{props.children}</>;
  });
  return Object.assign(forwardRef(renderFn), { renderFn });
};

export function MockComponents<T extends Record<string, any>>(components: T, overrides?: Partial<T>): Mocked<T> {
  return Object.keys(components).reduce((all, name: keyof T) => {
    all[name] = overrides?.[name] || (vi.fn(typeof name === "string" && name.startsWith("use") ? undefined : ComponentMock) as T[keyof T]);
    return all;
  }, {} as T);
}

export type Mocked<T extends Record<string, FC>> = {
  [K in keyof T]: MockedFunction<T[K]>;
};
