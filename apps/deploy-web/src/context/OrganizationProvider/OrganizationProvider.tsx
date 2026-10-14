"use client";
import type { ReactNode } from "react";
import React, { Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "jotai";
import { useRouter } from "next/router";

import { isProjectsUiEnabled } from "@src/components/organizations/organizationAccess";
import { BootLoading } from "@src/context/BootLoadingProvider/BootLoadingProvider";
import { useFeatureFlagsReady } from "@src/context/FlagProvider/FlagProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { serializeActiveOrganizationCookie } from "@src/lib/active-organization/active-organization-cookie";
import {
  ACTIVE_ORGANIZATION_QUERY_PARAM,
  removeActiveOrganizationQueryParam,
  resolveActiveOrganizationDeepLink
} from "@src/lib/active-organization/active-organization-deep-link";
import { readCachedOrganizations, useOrganizationsQuery } from "@src/queries/useOrganizationQueries";
import { resetOrganizationScopedState } from "@src/store/organizationScopedState";
import type { OrganizationOutput } from "@src/types/organization";
import { resolveOrganizationSwitchDestination } from "./organizationSwitchDestination";

export const DEPENDENCIES = { useFlag, useFeatureFlagsReady, useUser, useOrganizationsQuery, useRouter, useQueryClient, useStore, BootLoading };

export type SwitchOrganizationOptions = {
  /** Where to land after the switch instead of the page rule, e.g. the members page of a just-created organization. */
  destination?: string;
};

export type ActiveOrganization = {
  organizations: OrganizationOutput[];
  activeOrganization: OrganizationOutput | undefined;
  isLoading: boolean;
  /** The memberships could not be loaded, so nothing is known about the organization the user works in. */
  isError: boolean;
  /** Answers whether the switch happened; an organization the user does not belong to is ignored. */
  switchOrganization: (organizationId: string, options?: SwitchOrganizationOptions) => boolean;
  projectsEnabled: boolean;
};

type PendingSwitch = {
  organizationId: string;
  replacedMemberships: OrganizationOutput[] | undefined;
};

const WITHOUT_ORGANIZATIONS: ActiveOrganization = {
  organizations: [],
  activeOrganization: undefined,
  isLoading: false,
  isError: false,
  switchOrganization: () => false,
  projectsEnabled: false
};

const AWAITING_FEATURE_FLAGS: ActiveOrganization = { ...WITHOUT_ORGANIZATIONS, isLoading: true };

const OrganizationContext = React.createContext<ActiveOrganization>(WITHOUT_ORGANIZATIONS);

type Props = {
  children: ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export function OrganizationProvider({ children, dependencies: d = DEPENDENCIES }: Props) {
  const isEnabled = d.useFlag("organizations");
  const areFeatureFlagsReady = d.useFeatureFlagsReady();
  const { user } = d.useUser();
  const router = d.useRouter();
  const queryClient = d.useQueryClient();
  const store = d.useStore();
  const { staleOrganizationRecovery } = useServices();
  const { data: loadedOrganizations, isLoading, isError } = d.useOrganizationsQuery({ enabled: isEnabled && !!user?.id });
  const [knownOrganizations, setKnownOrganizations] = useState<OrganizationOutput[]>([]);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch>();
  const [organizationScopeKey, setOrganizationScopeKey] = useState(0);
  const [isSwitching, setIsSwitching] = useState(false);
  const handledOrganizationParam = useRef<string>();

  const isAwaitingMemberships = !!pendingSwitch && (!loadedOrganizations || loadedOrganizations === pendingSwitch.replacedMemberships);
  const awaitedOrganizationId = isAwaitingMemberships ? pendingSwitch?.organizationId : undefined;
  const organizations = isAwaitingMemberships ? knownOrganizations : loadedOrganizations ?? knownOrganizations;
  const activeOrganization = useMemo(
    () => organizations.find(organization => organization.id === awaitedOrganizationId) ?? organizations.find(organization => organization.isActive),
    [organizations, awaitedOrganizationId]
  );

  useEffect(
    function rememberLoadedOrganizations() {
      if (loadedOrganizations && !isAwaitingMemberships) setKnownOrganizations(loadedOrganizations);
    },
    [loadedOrganizations, isAwaitingMemberships]
  );

  useEffect(
    function settleSwitchOnceMembershipsReload() {
      if (pendingSwitch && !isAwaitingMemberships) setPendingSwitch(undefined);
    },
    [pendingSwitch, isAwaitingMemberships]
  );

  const restartOrganizationScope = useCallback(() => {
    resetOrganizationScopedState(store);
    setOrganizationScopeKey(key => key + 1);
  }, [store]);

  useEffect(
    function fallBackWhenOrganizationIsRefused() {
      return staleOrganizationRecovery.subscribe(() => {
        setPendingSwitch(undefined);
        setKnownOrganizations([]);
        restartOrganizationScope();
      });
    },
    [staleOrganizationRecovery, restartOrganizationScope]
  );

  const switchOrganization = useCallback(
    (organizationId: string, options?: SwitchOrganizationOptions) => {
      const memberships = readCachedOrganizations(queryClient) ?? organizations;
      const target = memberships.find(organization => organization.id === organizationId);
      if (!target) return false;

      document.cookie = serializeActiveOrganizationCookie(target.id);
      setKnownOrganizations(memberships);
      setPendingSwitch({ organizationId: target.id, replacedMemberships: loadedOrganizations });
      queryClient.clear();
      restartOrganizationScope();
      setIsSwitching(true);
      const uncoverPage = () => setIsSwitching(false);
      router.replace(options?.destination ?? resolveOrganizationSwitchDestination(router.asPath, target)).then(uncoverPage, uncoverPage);
      return true;
    },
    [queryClient, organizations, loadedOrganizations, restartOrganizationScope, router]
  );

  useEffect(
    function applyOrganizationDeepLink() {
      if (!isEnabled || !router.isReady || !loadedOrganizations || isAwaitingMemberships) return;

      const requested = router.query[ACTIVE_ORGANIZATION_QUERY_PARAM];
      if (requested === undefined) {
        handledOrganizationParam.current = undefined;
        return;
      }
      const requestedKey = String(requested);
      if (handledOrganizationParam.current === requestedKey) return;
      handledOrganizationParam.current = requestedKey;

      const targetId = resolveActiveOrganizationDeepLink(requested, loadedOrganizations);
      const urlWithoutParam = removeActiveOrganizationQueryParam(router.asPath);
      const serverActive = loadedOrganizations.find(organization => organization.isActive);

      if (targetId && targetId !== serverActive?.id) {
        switchOrganization(targetId, { destination: urlWithoutParam });
      } else {
        router.replace(urlWithoutParam, undefined, { shallow: true });
      }
    },
    [isEnabled, router, loadedOrganizations, isAwaitingMemberships, switchOrganization]
  );

  const value = useMemo<ActiveOrganization>(() => {
    if (!isEnabled) return areFeatureFlagsReady ? WITHOUT_ORGANIZATIONS : AWAITING_FEATURE_FLAGS;

    return {
      organizations,
      activeOrganization,
      isLoading: isLoading && organizations.length === 0,
      isError: isError && organizations.length === 0,
      switchOrganization,
      projectsEnabled: !!activeOrganization && isProjectsUiEnabled(activeOrganization)
    };
  }, [isEnabled, areFeatureFlagsReady, organizations, activeOrganization, isLoading, isError, switchOrganization]);

  const isOpeningRequestedOrganization = isEnabled && isLoading && router.query[ACTIVE_ORGANIZATION_QUERY_PARAM] !== undefined;

  return (
    <OrganizationContext.Provider value={value}>
      {isSwitching ? (
        <d.BootLoading />
      ) : (
        <>
          <Fragment key={organizationScopeKey}>{children}</Fragment>
          {isOpeningRequestedOrganization && <d.BootLoading />}
        </>
      )}
    </OrganizationContext.Provider>
  );
}

export function useActiveOrganization(): ActiveOrganization {
  return useContext(OrganizationContext);
}
