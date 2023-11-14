export * from "./dashboard";
export * from "./snapshots";
export * from "./block";
export * from "./transaction";
export * from "./address";
export * from "./validator";
export * from "./proposal";

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
  routes: Array<ISidebarRoute>;
};

export type ISidebarRoute = {
  title: string;
  icon: any;
  url: string;
  activeRoutes: string[];
  isNew?: boolean;
};
