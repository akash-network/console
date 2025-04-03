import { useMemo } from "react";
import type { QueryKey, UseQueryOptions } from "react-query";
import { useMutation, useQuery, useQueryClient } from "react-query";
import type { TemplateCategory, TemplateOutputSummary } from "@akashnetwork/http-sdk";
import { Snackbar } from "@akashnetwork/ui/components";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";

import { useCustomUser } from "@src/hooks/useCustomUser";
import { services } from "@src/services/http/http-browser.service";
import type { ITemplate } from "@src/types";
import { UrlService } from "@src/utils/urlUtils";
import { QueryKeys } from "./queryKeys";

async function getUserTemplates(username: string): Promise<ITemplate[]> {
  const response = await axios.get(`/api/proxy/user/templates/${username}`);

  return response.data;
}

export function useUserTemplates(username: string, options?: Omit<UseQueryOptions<ITemplate[], Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<ITemplate[], Error>(QueryKeys.getUserTemplatesKey(username), () => getUserTemplates(username), options);
}

async function getUserFavoriteTemplates(): Promise<Partial<ITemplate>[]> {
  const response = await axios.get(`/api/proxy/user/favoriteTemplates`);

  return response.data;
}

export function useUserFavoriteTemplates(options?: Omit<UseQueryOptions<Partial<ITemplate>[], Error, any, QueryKey>, "queryKey" | "queryFn">) {
  const { user } = useCustomUser();
  return useQuery<Partial<ITemplate>[], Error>(QueryKeys.getUserFavoriteTemplatesKey(user?.sub || ""), () => getUserFavoriteTemplates(), options);
}

async function getTemplate(id: string): Promise<ITemplate> {
  const response = await axios.get(`/api/proxy/user/template/${id}`);

  return response.data;
}

export function useTemplate(id: string, options?: Omit<UseQueryOptions<ITemplate, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<ITemplate, Error>(QueryKeys.getTemplateKey(id), () => getTemplate(id), options);
}

export function useSaveUserTemplate(isNew: boolean = false) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation(
    (template: Partial<ITemplate>) =>
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
    {
      onSuccess: (_response, newTemplate) => {
        queryClient.setQueryData<Partial<ITemplate>>(QueryKeys.getTemplateKey(_response.data), oldData => {
          return { ...oldData, ...newTemplate };
        });

        if (isNew && _response.data) {
          router.push(UrlService.sdlBuilder(_response.data));
        }
      }
    }
  );
}

export function useDeleteTemplate(id: string) {
  const { user } = useCustomUser();
  const queryClient = useQueryClient();

  return useMutation(() => axios.delete(`/api/proxy/user/deleteTemplate/${id}`), {
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
  return useMutation(() => axios.post(`/api/proxy/user/addFavoriteTemplate/${id}`), {
    onSuccess: () => {
      enqueueSnackbar(<Snackbar title="Favorite added!" iconVariant="success" />, { variant: "success" });
    }
  });
}

export function useRemoveFavoriteTemplate(id: string) {
  const { enqueueSnackbar } = useSnackbar();

  return useMutation(() => axios.delete(`/api/proxy/user/removeFavoriteTemplate/${id}`), {
    onSuccess: () => {
      enqueueSnackbar(<Snackbar title="Favorite removed" iconVariant="success" />, { variant: "success" });
    }
  });
}

async function getTemplates() {
  const response = await services.template.findGroupedByCategory();

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
  const query = useQuery(QueryKeys.getTemplatesKey(), () => getTemplates(), {
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
