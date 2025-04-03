import type { FC } from "react";

/**
 * Dump component that just renders children in React.Fragment
 */
export function ComponentMock(props: Record<string, any>) {
  return <>{props.children}</>;
}

export function MockComponents<T extends Record<string, any>>(components: T, overrides?: Partial<T>): Mocked<T> {
  return Object.keys(components).reduce((all, name: keyof T) => {
    all[name] = overrides?.[name] || (jest.fn(ComponentMock) as T[keyof T]);
    return all;
  }, {} as T);
}

export type Mocked<T extends Record<string, FC>> = {
  [K in keyof T]: jest.MockedFunction<T[K]>;
};
