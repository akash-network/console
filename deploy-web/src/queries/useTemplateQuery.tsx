import { UseQueryOptions, useQuery, QueryKey, useMutation, useQueryClient } from "react-query";
import axios from "axios";
import { QueryKeys } from "./queryKeys";
import { ITemplate } from "@src/types";
import { useRouter } from "next/navigation";
import { UrlService } from "@src/utils/urlUtils";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { ApiUrlService } from "@src/utils/apiUtils";
import { useToast } from "@src/components/ui/use-toast";

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
        queryClient.setQueryData(QueryKeys.getTemplateKey(_response.data), (oldData: ITemplate) => {
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
      queryClient.setQueryData(QueryKeys.getUserTemplatesKey(user?.username), (oldData: ITemplate[] = []) => {
        return oldData.filter(t => t.id !== id);
      });
    }
  });
}

export function useAddFavoriteTemplate(id: string) {
  const { toast } = useToast();
  return useMutation(() => axios.post(`/api/proxy/user/addFavoriteTemplate/${id}`), {
    onSuccess: () => {
      toast({ title: "Favorite added!", variant: "success" });
      // enqueueSnackbar(<Snackbar title="Favorite added!" iconVariant="success" />, { variant: "success" });
    }
  });
}

export function useRemoveFavoriteTemplate(id: string) {
  const { toast } = useToast();

  return useMutation(() => axios.delete(`/api/proxy/user/removeFavoriteTemplate/${id}`), {
    onSuccess: () => {
      toast({ title: "Favorite removed!", variant: "success" });
      // enqueueSnackbar(<Snackbar title="Favorite removed" iconVariant="success" />, { variant: "success" });
    }
  });
}

async function getTemplates() {
  const response = await axios.get(ApiUrlService.templates());

  if (!response.data) {
    return { categories: [], templates: [] };
  }

  let categories = response.data.filter(x => (x.templates || []).length > 0);
  categories.forEach(c => {
    c.templates.forEach(t => (t.category = c.title));
  });
  const templates = categories.flatMap(x => x.templates);

  return { categories, templates };
}

export function useTemplates(options = {}) {
  return useQuery(QueryKeys.getTemplatesKey(), () => getTemplates(), {
    ...options,
    refetchInterval: 60000 * 2, // Refetch templates every 2 minutes
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
}
