import type { FC } from "react";
import React, { useCallback, useEffect } from "react";

import type { AutoTopUpSettingProps } from "@src/components/settings/AutoTopUpSetting/AutoTopUpSetting";
import { AutoTopUpSetting } from "@src/components/settings/AutoTopUpSetting/AutoTopUpSetting";
import { useWallet } from "@src/context/WalletProvider";
import { useAutoTopUpLimits } from "@src/hooks/useAutoTopUpLimits";
import { useAutoTopUpService } from "@src/hooks/useAutoTopUpService";

export const AutoTopUpSettingContainer: FC = () => {
  const { address, signAndBroadcastTx } = useWallet();
  const { fetch, uaktFeeLimit, usdcFeeLimit, uaktDeploymentLimit, usdcDeploymentLimit, expiration } = useAutoTopUpLimits();
  const autoTopUpMessageService = useAutoTopUpService();

  useEffect(() => {
    fetch();
  }, []);

  const updateAllowancesAndGrants: AutoTopUpSettingProps["onSubmit"] = useCallback(
    async (action, next) => {
      const prev = {
        uaktFeeLimit,
        usdcFeeLimit,
        uaktDeploymentLimit,
        usdcDeploymentLimit,
        expiration
      };

      const messages = autoTopUpMessageService.collectMessages({
        granter: address,
        prev,
        next: action === "revoke-all" ? undefined : { ...next, expiration: new Date(next.expiration) }
      });

      if (messages.length) {
        await signAndBroadcastTx(messages);
      }

      await fetch();
    },
    [address, autoTopUpMessageService, expiration, fetch, signAndBroadcastTx, uaktDeploymentLimit, uaktFeeLimit, usdcDeploymentLimit, usdcFeeLimit]
  );

  return (
    <AutoTopUpSetting
      onSubmit={updateAllowancesAndGrants}
      uaktFeeLimit={uaktFeeLimit}
      usdcFeeLimit={usdcFeeLimit}
      uaktDeploymentLimit={uaktDeploymentLimit}
      usdcDeploymentLimit={usdcDeploymentLimit}
      expiration={expiration}
    />
  );
};
