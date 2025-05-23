"use client";
import type { ReactNode } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { InfoCircle } from "iconoir-react";

import { useSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import type { ServiceType } from "@src/types";
import { FormPaper } from "./FormPaper";

type Props = {
  currentService: ServiceType;
  serviceIndex?: number;
  children?: ReactNode;
  setIsEditingExpose: (value: boolean | number) => void;
};

export const ExposeList: React.FunctionComponent<Props> = ({ currentService, setIsEditingExpose, serviceIndex }) => {
  const { hasComponent } = useSdlBuilder();
  return (
    <FormPaper>
      <div className="mb-2 flex items-center">
        <strong className="text-sm">Expose</strong>

        <CustomTooltip
          title={
            <>
              Expose is a list of port settings describing what can connect to the service.
              {hasComponent("ssh") && (
                <>
                  <br />
                  <br />
                  Note: Port 22 is reserved for SSH and is going to be exposed by default.
                </>
              )}
              <br />
              <br />
              <a href="https://akash.network/docs/getting-started/stack-definition-language/#servicesexpose" target="_blank" rel="noopener">
                View official documentation.
              </a>
            </>
          }
        >
          <InfoCircle className="ml-2 text-xs text-muted-foreground" />
        </CustomTooltip>

        <span
          className="ml-4 cursor-pointer text-sm font-normal text-primary underline"
          onClick={() => setIsEditingExpose(serviceIndex !== undefined ? serviceIndex : true)}
        >
          Edit
        </span>
      </div>

      {currentService.expose?.map((exp, i) => (
        <div key={i} className={cn("text-xs", { ["mb-2"]: i + 1 !== currentService.expose.length })}>
          <div>
            <strong>Port</strong>&nbsp;&nbsp;
            <span className="text-muted-foreground">
              {exp.port} : {exp.as} ({exp.proto})
            </span>
          </div>
          <div>
            <strong>Global</strong>&nbsp;&nbsp;
            <span className="text-muted-foreground">{exp.global ? "True" : "False"}</span>
          </div>
          {exp.ipName && (
            <div>
              <strong>IP Name</strong>&nbsp;&nbsp;
              <span className="text-muted-foreground">{exp.ipName}</span>
            </div>
          )}
          <div>
            <strong>Accept</strong>&nbsp;&nbsp;
            <span className="text-muted-foreground">
              {(exp.accept?.length || 0) > 0
                ? exp.accept?.map((a, i) => (
                    <span
                      key={i}
                      className={cn({ ["ml-2"]: i !== 0 })}
                      // sx={{ marginLeft: i === 0 ? 0 : ".5rem" }}
                    >
                      {a.value}
                    </span>
                  ))
                : "None"}
            </span>
          </div>
        </div>
      ))}
    </FormPaper>
  );
};
