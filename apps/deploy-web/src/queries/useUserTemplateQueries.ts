import { useQueryClient } from "@tanstack/react-query";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";

export function useMarketplaceTemplate(id: string | undefined) {
  const { api } = useServices();

  return api.v1.getUserTemplate.useQuery({ id: id ?? "" }, { enabled: !!id, select: response => response.data });
}

export function useTemplateVersions(id: string | undefined, { enabled }: { enabled: boolean }) {
  const { api } = useServices();

  return api.v1.listUserTemplateVersions.useQuery({ id: id ?? "" }, { enabled: enabled && !!id, select: response => response.data });
}

export function useTemplateVersion(id: string | undefined, version: number | undefined) {
  const { api } = useServices();

  return api.v1.getUserTemplateVersion.useQuery(
    { id: id ?? "", version: version ?? 0 },
    { enabled: !!id && version !== undefined, select: response => response.data }
  );
}

export function useMyTemplates() {
  const { api } = useServices();

  return api.v1.listUserTemplates.useQuery(undefined, { select: response => response.data });
}

/** The list is keyed by the active organization, so switching never shows the previous organization's templates. */
export function useOrganizationTemplates({ enabled }: { enabled: boolean }) {
  const { api } = useServices();
  const { activeOrganization } = useActiveOrganization();

  return api.v1.listUserTemplates.useQuery(
    { visibility: "organization" },
    { enabled: enabled && !!activeOrganization, queryKey: [activeOrganization?.id], select: response => response.data }
  );
}

export function useCreateTemplateMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.createUserTemplate.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: api.v1.listUserTemplates.getKey() })
  });
}

export function useCreateTemplateVersionMutation(id: string) {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.createUserTemplateVersion.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: api.v1.getUserTemplate.getKey({ id }) }),
        queryClient.invalidateQueries({ queryKey: api.v1.listUserTemplateVersions.getKey({ id }) }),
        queryClient.invalidateQueries({ queryKey: api.v1.listUserTemplates.getKey() })
      ])
  });
}

export function useUpdateTemplateSettingsMutation(id: string) {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.updateUserTemplate.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: response => {
      queryClient.setQueryData(api.v1.getUserTemplate.getKey({ id }), response);
      return queryClient.invalidateQueries({ queryKey: api.v1.listUserTemplates.getKey() });
    }
  });
}

export function useDeleteMarketplaceTemplateMutation(id: string) {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.deleteUserTemplate.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: api.v1.getUserTemplate.getKey({ id }) });
      return queryClient.invalidateQueries({ queryKey: api.v1.listUserTemplates.getKey() });
    }
  });
}
