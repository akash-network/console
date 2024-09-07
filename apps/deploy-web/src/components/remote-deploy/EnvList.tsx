"use client";
import { Dispatch, ReactNode, SetStateAction } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { ServiceType } from "@src/types";
import { FormPaper } from "../sdl/FormPaper";
import { hiddenEnv } from "./utils";

type Props = {
  currentService: ServiceType;
  serviceIndex?: number;
  children?: ReactNode;
  setIsEditingEnv: Dispatch<SetStateAction<boolean | number>>;
};

export const EnvVarList: React.FunctionComponent<Props> = ({ currentService, setIsEditingEnv, serviceIndex }) => {
  const envs = currentService.env?.filter(e => !hiddenEnv.includes(e.key));
  return (
    <FormPaper className="whitespace-break-spaces break-all rounded-sm !bg-card">
      <div className="mb-2 flex items-center">
        <strong className="text-sm">Environment Variables</strong>

        <CustomTooltip
          title={
            <>
              A list of environment variables to expose to the running container.
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

      {(envs?.length || 0) > 0 ? (
        envs?.map((e, i) => (
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
