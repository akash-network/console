"use client";
import type { FC } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { paths } from "@akashnetwork/console-api-types";
import { isApiError } from "@akashnetwork/openapi-sdk";
import { Button, Snackbar, Spinner } from "@akashnetwork/ui/components";
import { format } from "date-fns";
import { BellIcon } from "lucide-react";
import { useRouter } from "next/router";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useGpuWaitlistQuery, useKeepGpuWaitlistEntryMutation } from "@src/queries/useGpuWaitlistQuery";
import { describeGpuSetup } from "../describeGpuSetup/describeGpuSetup";
import { LeaveGpuAlertDialog } from "./LeaveGpuAlertDialog";

export const DEPENDENCIES = { LeaveGpuAlertDialog, useGpuWaitlistQuery, useKeepGpuWaitlistEntryMutation, useRouter, useSnackbar, useServices };

type GpuAlertEntry = paths["/v1/gpu-waitlist"]["get"]["responses"][200]["content"]["application/json"]["data"][number];

type Props = { dependencies?: typeof DEPENDENCIES };

export const GpuAlertsSection: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const router = d.useRouter();
  const { enqueueSnackbar } = d.useSnackbar();
  const { analyticsService } = d.useServices();
  const { data: entries, isLoading, isError, isSuccess, isFetching } = d.useGpuWaitlistQuery();
  const { mutate: keepEntry } = d.useKeepGpuWaitlistEntryMutation();
  const [leaving, setLeaving] = useState<GpuAlertEntry | null>(null);
  const handledLeaveAlertId = useRef<string>();
  const handledKeepAlertId = useRef<string>();
  const leaveAlertId = singleQueryValue(router.query.leaveAlert);
  const keepAlertId = singleQueryValue(router.query.keepAlert);
  const isOrganizationSettled = router.isReady && router.query.org === undefined;

  const pathWithoutHandledParams = useRef(router.asPath);
  pathWithoutHandledParams.current = router.asPath;

  const announceEnded = useCallback(
    () => enqueueSnackbar(<Snackbar title="This alert has already ended" iconVariant="info" />, { variant: "info" }),
    [enqueueSnackbar]
  );
  const dropLinkParam = useCallback(
    (name: string) => {
      pathWithoutHandledParams.current = withoutQueryParam(pathWithoutHandledParams.current, name);
      router.replace(pathWithoutHandledParams.current, undefined, { shallow: true });
    },
    [router]
  );

  useEffect(
    function openLeaveDialogFromEmailLink() {
      if (!isOrganizationSettled || !leaveAlertId || !isSuccess || isFetching || handledLeaveAlertId.current === leaveAlertId) return;
      handledLeaveAlertId.current = leaveAlertId;

      const entry = entries?.find(candidate => candidate.id === leaveAlertId);
      if (entry) setLeaving(entry);
      else announceEnded();
      dropLinkParam("leaveAlert");
    },
    [isOrganizationSettled, leaveAlertId, isSuccess, isFetching, entries, announceEnded, dropLinkParam]
  );

  useEffect(
    function keepAlertFromEmailLink() {
      if (!isOrganizationSettled || !keepAlertId || handledKeepAlertId.current === keepAlertId) return;
      handledKeepAlertId.current = keepAlertId;

      keepEntry(
        { id: keepAlertId },
        {
          onSuccess: ({ data: entry }) => {
            analyticsService.track("gpu_alert_kept", { category: "deployments", model: entry.model, gpuCount: entry.gpuCount });
            enqueueSnackbar(<Snackbar title="Your alert stays on" subTitle={`You're #${entry.placeInLine} in line.`} iconVariant="success" />, {
              variant: "success"
            });
          },
          onError: error => {
            if (isApiError(error) && error.status === 404) return announceEnded();
            enqueueSnackbar(<Snackbar title="Couldn't keep your alert" subTitle="Try the link in the email again in a moment." iconVariant="error" />, {
              variant: "error"
            });
          }
        }
      );
      dropLinkParam("keepAlert");
    },
    [isOrganizationSettled, keepAlertId, keepEntry, analyticsService, enqueueSnackbar, announceEnded, dropLinkParam]
  );

  return (
    <section aria-labelledby="gpu-alerts-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="gpu-alerts-heading" className="text-base font-semibold">
          GPU alerts
        </h2>
        <p className="text-sm text-muted-foreground">We email you when a GPU you're waiting for frees up. Whoever deploys first gets it.</p>
      </div>
      {isLoading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size="small" />
          Loading your alerts…
        </p>
      )}
      {isError && (
        <p role="alert" className="text-sm text-muted-foreground">
          Couldn&apos;t load your alerts. Try again in a moment.
        </p>
      )}
      {entries?.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
            <BellIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <h3 className="mt-1 text-base font-semibold">No GPU alerts</h3>
          <p className="max-w-md text-sm text-muted-foreground">Pick &quot;Notify me&quot; when a GPU isn&apos;t available and it will show up here.</p>
        </div>
      )}
      {!!entries?.length && (
        <ul className="flex flex-col gap-3">
          {entries.map(entry => (
            <li key={entry.id} className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{describeGpuSetup(entry)}</span>
                <span className="text-xs text-muted-foreground">
                  #{entry.placeInLine} in line · Joined {formatDay(entry.joinedAt)} ·{" "}
                  {entry.lastNotifiedAt ? `Last emailed ${formatDay(entry.lastNotifiedAt)}` : "Not emailed yet"}
                </span>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setLeaving(entry)}>
                Leave
              </Button>
            </li>
          ))}
        </ul>
      )}
      {leaving && <d.LeaveGpuAlertDialog entry={leaving} label={describeGpuSetup(leaving)} onClose={() => setLeaving(null)} />}
    </section>
  );
};

function formatDay(isoDate: string): string {
  return format(new Date(isoDate), "MMM d, yyyy");
}

function singleQueryValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function withoutQueryParam(asPath: string, name: string): string {
  const url = new URL(asPath, "http://localhost");
  url.searchParams.delete(name);
  return `${url.pathname}${url.search}${url.hash}`;
}
