export const stub = <T>(obj: Record<string, any> = {}) => obj as jest.Mocked<T>;
