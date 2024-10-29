export * from "./dashboard";
export * from "./block";
export * from "./transaction";
export * from "./coin";

export type IGraphDataPoint = {
  date: string;
  value: number;
};

export type PaginatedResults<T> = {
  results: T[];
  count: number;
};

export type ISidebarGroupMenu = {
  title?: string;
  hasDivider?: boolean;
  routes: Array<ISidebarRoute>;
};

export type ISidebarRoute = {
  title: string;
  icon: any;
  url: string;
  activeRoutes: string[];
  isNew?: boolean;
  rel?: string;
  target?: string;
  disabled?: boolean;
};
