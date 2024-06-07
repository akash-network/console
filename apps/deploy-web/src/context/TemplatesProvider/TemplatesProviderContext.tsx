"use client";
import React from "react";

import { useTemplates as useTemplatesQuery } from "@src/queries/useTemplateQuery";
import { ApiTemplate } from "@src/types";

type ContextType = {
  isLoading: boolean;
  categories: Array<{ title: string; templates: Array<ApiTemplate> }>;
  templates: Array<ApiTemplate>;
  getTemplateById: (id: string) => ApiTemplate;
};

const TemplatesProviderContext = React.createContext<ContextType>({} as ContextType);

export const TemplatesProvider = ({ children }) => {
  const { data, isFetching: isLoading } = useTemplatesQuery();
  const categories = data ? data.categories : [];
  const templates = data ? data.templates : [];

  function getTemplateById(id: string) {
    return categories.flatMap(x => x.templates).find(x => x.id === id);
  }

  return <TemplatesProviderContext.Provider value={{ isLoading, categories, templates, getTemplateById }}>{children}</TemplatesProviderContext.Provider>;
};

export const useTemplates = () => {
  return { ...React.useContext(TemplatesProviderContext) };
};
