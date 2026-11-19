import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { useGpuWaitlistQuery, useJoinGpuWaitlistMutation } from "@src/queries/useGpuWaitlistQuery";
import { describeGpuSetup } from "../describeGpuSetup/describeGpuSetup";
import type { GpuWaitlistSetup } from "../gpuWaitlistMatch/gpuWaitlistMatch";
import { findWaitingEntry } from "../gpuWaitlistMatch/gpuWaitlistMatch";

export const DEPENDENCIES = { useFlag, useUser, useSnackbar, useGpuWaitlistQuery, useJoinGpuWaitlistMutation, useServices };

export type GpuWaitlistSource = "gpu_menu" | "no_fit" | "no_bids";

export type NotifyMeSetup = GpuWaitlistSetup & { gpuCount: number };

export function useNotifyMe(d = DEPENDENCIES) {
  const { analyticsService } = d.useServices();
  const isEnabled = d.useFlag("gpu_availability_alerts");
  const { user } = d.useUser();
  const { enqueueSnackbar } = d.useSnackbar();
  const { data: entries } = d.useGpuWaitlistQuery({ enabled: isEnabled && !!user });
  const join = d.useJoinGpuWaitlistMutation();

  function findEntry(setup: GpuWaitlistSetup) {
    return findWaitingEntry(entries, setup);
  }

  function notify(setup: NotifyMeSetup, source: GpuWaitlistSource) {
    const gpu = setup;
    join.mutate(
      {
        data: {
          vendor: gpu.vendor as "nvidia",
          model: gpu.model,
          memory: gpu.memory ?? undefined,
          interface: gpu.interface ?? undefined,
          gpuCount: gpu.gpuCount,
          source
        }
      },
      {
        onSuccess: function confirmPlaceInLine({ data: entry }) {
          analyticsService.track("gpu_alert_joined", { category: "deployments", source, model: entry.model, gpuCount: entry.gpuCount });
          enqueueSnackbar(
            <Snackbar
              title={`You're #${entry.placeInLine} in line for ${describeGpuSetup(entry)}`}
              subTitle="We'll email you when it frees up. Whoever deploys first gets it."
              iconVariant="success"
            />,
            { variant: "success" }
          );
        },
        onError: function explainRefusal(error) {
          enqueueSnackbar(<Snackbar title="Couldn't add you to the waitlist" subTitle={extractApiErrorMessage(error) ?? undefined} iconVariant="error" />, {
            variant: "error"
          });
        }
      }
    );
  }

  return { isEnabled: isEnabled && !!user, notify, findEntry, isWaiting: (setup: GpuWaitlistSetup) => !!findEntry(setup), isPending: join.isPending };
}
