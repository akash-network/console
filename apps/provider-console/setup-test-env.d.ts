import "@testing-library/jest-dom";

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveClass: (...classNames: string[]) => R;
      toHaveAttribute: (attr: string, value?: string) => R;
    }
  }
}
