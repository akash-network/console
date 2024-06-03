"use client";
import { Dispatch, ReactNode, SetStateAction } from "react";
import { InfoCircle } from "iconoir-react";

import { Service } from "@src/types";
import { cn } from "@src/utils/styleUtils";
import { CustomTooltip } from "../shared/CustomTooltip";
import { FormPaper } from "./FormPaper";

type Props = {
  currentService: Service;
  serviceIndex?: number;
  children?: ReactNode;
  setIsEditingExpose: Dispatch<SetStateAction<boolean | number>>;
};

export const ExposeList: React.FunctionComponent<Props> = ({ currentService, setIsEditingExpose, serviceIndex }) => {
  return (
    <FormPaper>
      <div className="mb-2 flex items-center">
        <strong className="text-sm">Expose</strong>

        <CustomTooltip
          title={
            <>
              Expose is a list of port settings describing what can connect to the service.
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
