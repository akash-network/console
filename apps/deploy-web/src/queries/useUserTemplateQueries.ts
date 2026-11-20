import { useQueryClient } from "@tanstack/react-query";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useServices } from "@src/context/ServicesProvider";
import { isClientError, SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";
import type { CommunityTemplateGallery, CurrentTemplatePublisher, MarketplaceTemplate, TemplatePublisherPage } from "@src/types/marketplace-template";

/** A template link outlives its template, and the page answers a deleted, removed or private one itself. */
const SKIP_REPORTING_UNREADABLE_TEMPLATE = { skipErrorReporting: isClientError };

export function useMarketplaceTemplate(id: string | undefined) {
  const { api } = useServices();

  return api.v1.getUserTemplate.useQuery(
    { id: id ?? "" },
    { enabled: !!id, meta: SKIP_REPORTING_UNREADABLE_TEMPLATE, select: (response): MarketplaceTemplate => response.data }
  );
}

export function useTemplateVersions(id: string | undefined, { enabled }: { enabled: boolean }) {
  const { api } = useServices();

  return api.v1.listUserTemplateVersions.useQuery(
    { id: id ?? "" },
    { enabled: enabled && !!id, meta: SKIP_REPORTING_UNREADABLE_TEMPLATE, select: response => response.data }
  );
}

export function useTemplateVersion(id: string | undefined, version: number | undefined) {
  const { api } = useServices();

  return api.v1.getUserTemplateVersion.useQuery(
    { id: id ?? "", version: version ?? 0 },
    { enabled: !!id && version !== undefined, meta: SKIP_REPORTING_UNREADABLE_TEMPLATE, select: response => response.data }
  );
}

/** The API serves one answer to everyone and refreshes it once a minute, so asking more often only repeats it. */
const COMMUNITY_GALLERY_STALE_MS = 60_000;

export function useCommunityTemplates({ enabled }: { enabled: boolean }) {
  const { api } = useServices();

  return api.v1.listCommunityTemplates.useQuery(undefined, {
    enabled,
    staleTime: COMMUNITY_GALLERY_STALE_MS,
    meta: SKIP_REPORTING_REFUSED_INPUT,
    select: (response): CommunityTemplateGallery => response.data
  });
}

/** Anyone may read a publisher page, so the query carries nothing of the session and a server render can prefetch it under the same key. */
export function useTemplatePublisher(handle: string) {
  const { api } = useServices();

  return api.v1.getTemplatePublisher.useQuery(
    { handle },
    { staleTime: COMMUNITY_GALLERY_STALE_MS, meta: SKIP_REPORTING_REFUSED_INPUT, select: (response): TemplatePublisherPage => response.data }
  );
}

/** Keyed by the active organization, whose profile it reads; a 404 says the organization has not published yet. */
export function useCurrentTemplatePublisher({ enabled }: { enabled: boolean }) {
  const { api } = useServices();
  const { activeOrganization } = useActiveOrganization();

  return api.v1.getCurrentTemplatePublisher.useQuery(undefined, {
    enabled: enabled && !!activeOrganization,
    queryKey: [activeOrganization?.id],
    meta: SKIP_REPORTING_REFUSED_INPUT,
    select: (response): CurrentTemplatePublisher => response.data
  });
}

export function useUpdateTemplatePublisherMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();
  const { activeOrganization } = useActiveOrganization();

  return api.v1.updateCurrentTemplatePublisher.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: response => {
      queryClient.setQueryData([...api.v1.getCurrentTemplatePublisher.getKey(), activeOrganization?.id], response);
      return queryClient.invalidateQueries({ queryKey: api.v1.getTemplatePublisher.getKey({ handle: response.data.handle }) });
    }
  });
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

/** The checks run on the server at request time, so a result is never reused: the dialog always shows a fresh run. */
export function useTemplatePublishReadiness(id: string, { enabled }: { enabled: boolean }) {
  const { api } = useServices();

  return api.v1.getUserTemplatePublishReadiness.useQuery(
    { id },
    { enabled, staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: false, meta: SKIP_REPORTING_REFUSED_INPUT, select: response => response.data }
  );
}

export function usePublishTemplateMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.publishUserTemplate.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: (response, { id }) => {
      queryClient.setQueryData(api.v1.getUserTemplate.getKey({ id }), response);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: api.v1.listUserTemplateVersions.getKey({ id }) }),
        queryClient.invalidateQueries({ queryKey: api.v1.listUserTemplates.getKey() })
      ]);
    }
  });
}

export function useReportTemplateMutation() {
  const { api } = useServices();

  return api.v1.createUserTemplateReport.useMutation({ meta: SKIP_REPORTING_REFUSED_INPUT });
}
