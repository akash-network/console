"use client";
import { Dispatch, ReactNode, SetStateAction } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { Service } from "@src/types";
import { FormPaper } from "./FormPaper";

type Props = {
  currentService: Service;
  serviceIndex?: number;
  children?: ReactNode;
  setIsEditingEnv: Dispatch<SetStateAction<boolean | number>>;
  ssh?: boolean;
};

export const EnvVarList: React.FunctionComponent<Props> = ({ currentService, setIsEditingEnv, serviceIndex, ssh }) => {
  return (
    <FormPaper className="whitespace-break-spaces break-all">
      <div className="mb-2 flex items-center">
        <strong className="text-sm">Environment Variables</strong>

        <CustomTooltip
          title={
            <>
              A list of environment variables to expose to the running container.
              {ssh && (
                <>
                  <br />
                  <br />
                  Note: The SSH_PUBKEY environment variable is reserved and is going to be overridden by the value provided to the relevant field.
                </>
              )}
              <br />
              <br />
              <a href="https://akash.network/docs/getting-started/stack-definition-language/#services" target="_blank" rel="noopener">
                View official documentation.
              </a>
            </>
          }
        >
          <InfoCircle className="ml-2 text-xs text-muted-foreground" />
        </CustomTooltip>

        <span
          className="ml-4 cursor-pointer text-sm font-normal text-primary underline"
          onClick={() => setIsEditingEnv(serviceIndex !== undefined ? serviceIndex : true)}
        >
          Edit
        </span>
      </div>

      {(currentService.env?.length || 0) > 0 ? (
        currentService.env?.map((e, i) => (
          <div key={i} className="text-xs">
            {e.key}=<span className="text-muted-foreground">{e.value}</span>
          </div>
        ))
      ) : (
        <p className="text-xs text-muted-foreground">None</p>
      )}
    </FormPaper>
  );
};
