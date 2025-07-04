import { useMemo } from "react";
import type { TemplateCategory, TemplateHttpService, TemplateOutputSummary } from "@akashnetwork/http-sdk";
import { Snackbar } from "@akashnetwork/ui/components";
import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import type { ITemplate } from "@src/types";
import { QueryKeys } from "./queryKeys";

export function useUserTemplates(username: string, options?: Omit<UseQueryOptions<ITemplate[], Error, any, QueryKey>, "queryKey" | "queryFn">) {
  const { axios } = useServices();
  return useQuery<ITemplate[], Error>({
    queryKey: QueryKeys.getUserTemplatesKey(username),
    queryFn: () => axios.get<ITemplate[]>(`/api/proxy/user/templates/${username}`).then(response => response.data),
    ...options
  });
}

export function useUserFavoriteTemplates(options?: Omit<UseQueryOptions<Partial<ITemplate>[], Error, any, QueryKey>, "queryKey" | "queryFn">) {
  const { user } = useCustomUser();
  const { axios } = useServices();
  return useQuery<Partial<ITemplate>[], Error>({
    queryKey: QueryKeys.getUserFavoriteTemplatesKey(user?.sub || ""),
    queryFn: () => axios.get<Partial<ITemplate>[]>(`/api/proxy/user/favoriteTemplates`).then(response => response.data),
    ...options
  });
}

export function useTemplate(id: string, options?: Omit<UseQueryOptions<ITemplate, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  const { axios } = useServices();

  return useQuery<ITemplate, Error>({
    queryKey: QueryKeys.getTemplateKey(id),
    queryFn: () => axios.get<ITemplate>(`/api/proxy/user/template/${id}`).then(response => response.data),
    ...options
  });
}

export function useSaveUserTemplate(
  options: {
    onSuccess?: (template: Partial<ITemplate>) => void;
  } = {}
) {
  const queryClient = useQueryClient();
  const { axios } = useServices();

  return useMutation({
    mutationFn: (template: Partial<ITemplate>) =>
      axios.post("/api/proxy/user/saveTemplate", {
        id: template.id,
        sdl: template.sdl,
        isPublic: template.isPublic,
        title: template.title,
        description: template.description,
        cpu: template.cpu,
        ram: template.ram,
        storage: template.storage
      }),
    onSuccess: (_response, newTemplate) => {
      queryClient.setQueryData<Partial<ITemplate>>(QueryKeys.getTemplateKey(_response.data), oldData => {
        return { ...oldData, ...newTemplate };
      });
      options.onSuccess?.(_response.data);
    }
  });
}

export function useDeleteTemplate(id: string) {
  const { user } = useCustomUser();
  const queryClient = useQueryClient();
  const { axios } = useServices();

  return useMutation({
    mutationFn: () => axios.delete(`/api/proxy/user/deleteTemplate/${id}`),
    onSuccess: () => {
      if (user.username) {
        queryClient.setQueryData(QueryKeys.getUserTemplatesKey(user?.username), (oldData: ITemplate[] = []) => {
          return oldData.filter(t => t.id !== id);
        });
      }
    }
  });
}

export function useAddFavoriteTemplate(id: string) {
  const { enqueueSnackbar } = useSnackbar();
  const { axios } = useServices();

  return useMutation({
    mutationFn: () => axios.post(`/api/proxy/user/addFavoriteTemplate/${id}`),
    onSuccess: () => {
      enqueueSnackbar(<Snackbar title="Favorite added!" iconVariant="success" />, { variant: "success" });
    }
  });
}

export function useRemoveFavoriteTemplate(id: string) {
  const { enqueueSnackbar } = useSnackbar();
  const { axios } = useServices();

  return useMutation({
    mutationFn: () => axios.delete(`/api/proxy/user/removeFavoriteTemplate/${id}`),
    onSuccess: () => {
      enqueueSnackbar(<Snackbar title="Favorite removed" iconVariant="success" />, { variant: "success" });
    }
  });
}

async function getTemplates(templateService: TemplateHttpService) {
  const response = await templateService.findGroupedByCategory();

  if (!response.data) {
    return { categories: [], templates: [] };
  }

  const categories = response.data.filter(x => !!x.templates?.length);
  const modifiedCategories = categories.map(category => {
    const templatesWithCategory = category.templates.map(template => ({
      ...template,
      category: category.title
    }));

    return { ...category, templates: templatesWithCategory };
  });
  const templates = modifiedCategories.flatMap(category => category.templates);

  return { categories: modifiedCategories, templates };
}

export interface EnhancedTemplateCategory extends Omit<TemplateCategory, "templates"> {
  templates: TemplateOutputSummaryWithCategory[];
}

export interface TemplateOutputSummaryWithCategory extends TemplateOutputSummary {
  category: TemplateCategory["title"];
}

export interface CategoriesAndTemplates {
  categories: EnhancedTemplateCategory[];
  templates: TemplateOutputSummaryWithCategory[];
}

export interface CategoriesAndTemplatesResult extends CategoriesAndTemplates {
  isLoading: boolean;
}

export function useTemplates(options = {}): CategoriesAndTemplatesResult {
  const { template: templateService } = useServices();
  const query = useQuery({
    queryKey: QueryKeys.getTemplatesKey(),
    queryFn: () => getTemplates(templateService),
    ...options,
    refetchInterval: 60000 * 2, // Refetch templates every 2 minutes
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  return useMemo(
    () => ({
      isLoading: query.isFetching,
      categories: query.data?.categories || [],
      templates: query.data?.templates || []
    }),
    [query.isFetching, query.data]
  );
}
