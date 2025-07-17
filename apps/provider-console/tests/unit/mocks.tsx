import type { FC } from "react";

/**
 * Dump component that just renders children in React.Fragment
 */
export function ComponentMock(props: Record<string, unknown>) {
  return <>{props.children}</>;
}

export function MockComponents<T extends Record<string, FC>>(components: T, overrides?: Partial<T>) {
  return Object.keys(components).reduce(
    (all, name: keyof T) => {
      all[name] = (overrides?.[name] as jest.MockedFunction<FC>) || jest.fn(ComponentMock);
      return all;
    },
    {} as Record<keyof T, jest.MockedFunction<FC>>
  );
}

export type Mocked<T extends Record<string, FC>> = {
  [K in keyof T]: jest.MockedFunction<T[K]>;
};
