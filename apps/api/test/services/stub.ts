/** @deprecated use `mock` from vitest-mock-extended instead */
export const stub = <T>(obj: Record<string, any> = {}) => obj as jest.Mocked<T>;
