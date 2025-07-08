export const safeParseJson = <T>(json: string, defaultValue?: T): T | null => {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    return (defaultValue as T) ?? null;
  }
};
