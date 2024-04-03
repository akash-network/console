type BreakpointKey = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
type Breakpoints = {
  [key in BreakpointKey]: {
    value: number;
    mediaQuery: string;
  };
};

// TODO: Implement up/down https://mui.com/material-ui/customization/breakpoints/
export const breakpoints: Breakpoints = {
  xs: { value: 0, mediaQuery: "(max-width: 640px)" },
  sm: { value: 640, mediaQuery: "(min-width: 640px)" },
  md: { value: 768, mediaQuery: "(min-width: 768px)" },
  lg: { value: 1024, mediaQuery: "(min-width: 1024px)" },
  xl: { value: 1280, mediaQuery: "(min-width: 1280px)" },
  "2xl": { value: 1536, mediaQuery: "(min-width: 1536px)" }
};
