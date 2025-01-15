"use client";
import React from "react";

import { EnhancedTemplateCategory, TemplateOutputSummaryWithCategory, useTemplates as useTemplatesQuery } from "@src/queries/useTemplateQuery";

type ContextType = {
  isLoading: boolean;
  categories: EnhancedTemplateCategory[];
  templates: TemplateOutputSummaryWithCategory[];
};

const TemplatesProviderContext = React.createContext<ContextType>({} as ContextType);

export const TemplatesProvider = ({ children }) => {
  const { data, isFetching: isLoading } = useTemplatesQuery();
  const categories = data?.categories || [];
  const templates = data?.templates || [];

  return <TemplatesProviderContext.Provider value={{ isLoading, categories, templates }}>{children}</TemplatesProviderContext.Provider>;
};

export const useTemplates = () => {
  return { ...React.useContext(TemplatesProviderContext) };
};
