"use client";
import { createContext, useContext } from "react";

const ProjectScopeContext = createContext<string | null>(null);

/** Marks a subtree as one project's page, where every deployment already belongs to that project. */
export const ProjectScopeProvider = ProjectScopeContext.Provider;

export function useProjectScope(): string | null {
  return useContext(ProjectScopeContext);
}
