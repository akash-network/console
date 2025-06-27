export type ChangeableComponentProps<T extends object> = T & {
  onStateChange?: (value: { hasChanges: boolean }) => void;
};
