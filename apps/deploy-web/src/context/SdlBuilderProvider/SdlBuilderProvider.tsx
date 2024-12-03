import React, { FC, useCallback, useMemo, useState } from "react";

import type { FCWithChildren } from "@src/types/component";
import { sshVmDistros } from "@src/utils/sdl/data";

type ComponentNames = "command" | "service-count" | "ssh" | "ssh-toggle" | "yml-editor" | "yml-uploader";
interface SdlContextProps {
  hasComponent: (component: ComponentNames) => boolean;
  toggleCmp: (component: ComponentNames) => void;
  imageList?: string[];
}

const SdlContext = React.createContext<SdlContextProps | undefined>(undefined);

type SdlBuilderComponentsSet = "ssh" | "ssh-toggled" | "default";

type SdlBuilderProviderProps = {
  imageSource?: "ssh-vms" | "user-provided";
} & (
  | {
      hiddenComponents?: ComponentNames[];
    }
  | {
      componentsSet: SdlBuilderComponentsSet;
    }
);

const COMPONENTS_SETS: Record<SdlBuilderComponentsSet, ComponentNames[]> = {
  ssh: ["command", "service-count", "ssh-toggle", "yml-editor", "yml-uploader"],
  "ssh-toggled": ["ssh"],
  default: ["ssh", "ssh-toggle"]
};

export const SdlBuilderProvider: FCWithChildren<SdlBuilderProviderProps> = ({ children, imageSource, ...props }) => {
  const inputHiddenComponents =
    ("hiddenComponents" in props && props.hiddenComponents) || ("componentsSet" in props && COMPONENTS_SETS[props.componentsSet]) || COMPONENTS_SETS.default;
  const imageList = imageSource === "ssh-vms" ? sshVmDistros : undefined;
  const [hiddenComponents, setHiddenComponents] = useState<Set<ComponentNames>>(new Set(inputHiddenComponents || []));
  const toggleCmp = useCallback(
    (component: ComponentNames) => {
      setHiddenComponents(prev => {
        const next = new Set(prev);
        next.has(component) ? next.delete(component) : next.add(component);
        return next;
      });
    },
    [setHiddenComponents]
  );
  const hasComponent = useCallback((component: ComponentNames) => !hiddenComponents.has(component), [hiddenComponents]);
  const context = useMemo(
    () => ({
      hasComponent,
      toggleCmp,
      imageList
    }),
    [imageList, hasComponent, toggleCmp]
  );

  return <SdlContext.Provider value={context}>{children}</SdlContext.Provider>;
};

export const useSdlBuilder = () => {
  const context = React.useContext(SdlContext);
  if (!context) {
    throw new Error("useSdlBuilder must be used within a SdlContext");
  }
  return context;
};

export const withSdlBuilder = (options: SdlBuilderProviderProps = {}) =>
  function wrapWithSdlBuilder<P extends Record<string, any>>(Component: React.ComponentType<P>): FC<P> | React.ComponentType<P> {
    return function WrappedComponent(props: P) {
      return (
        <SdlBuilderProvider {...options}>
          <Component {...props} />
        </SdlBuilderProvider>
      );
    };
  };
