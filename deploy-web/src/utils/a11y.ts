export function a11yTabProps(prefix: string, controlPrefix: string, index: number) {
  return {
    id: `${prefix}-${index}`,
    "aria-controls": `${controlPrefix}-${index}`
  };
}
