import { useQueryClient } from "@tanstack/react-query";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";
import type { MarketplaceTemplate } from "@src/types/marketplace-template";

export function useMarketplaceTemplate(id: string | undefined) {
  const { api } = useServices();

  return api.v1.getUserTemplate.useQuery({ id: id ?? "" }, { enabled: !!id, select: (response): MarketplaceTemplate => response.data });
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

/** Keyed by the active organization, so a switch never shows the previous one's templates, and idle without one because the key needs its id. */
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

export function useCreateTemplateVersionMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.createUserTemplateVersion.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: (_, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: api.v1.getUserTemplate.getKey({ id }) }),
        queryClient.invalidateQueries({ queryKey: api.v1.listUserTemplateVersions.getKey({ id }) }),
        queryClient.invalidateQueries({ queryKey: api.v1.listUserTemplates.getKey() })
      ])
  });
}

export function useUpdateTemplateSettingsMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.updateUserTemplate.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: (response, { id }) => {
      queryClient.setQueryData(api.v1.getUserTemplate.getKey({ id }), response);
      return queryClient.invalidateQueries({ queryKey: api.v1.listUserTemplates.getKey() });
    }
  });
}

export function useDeleteMarketplaceTemplateMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.deleteUserTemplate.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: api.v1.listUserTemplates.getKey() })
  });
}
