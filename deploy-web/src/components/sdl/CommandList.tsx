"use client";
import { Dispatch, ReactNode, SetStateAction } from "react";
import { Service } from "@src/types";
import { CustomTooltip } from "../shared/CustomTooltip";
import { FormPaper } from "./FormPaper";
import { InfoCircle } from "iconoir-react";

type Props = {
  currentService: Service;
  serviceIndex?: number;
  children?: ReactNode;
  setIsEditingCommands: Dispatch<SetStateAction<boolean | number>>;
};

export const CommandList: React.FunctionComponent<Props> = ({ currentService, setIsEditingCommands, serviceIndex }) => {
  return (
    <FormPaper>
      <div className="mb-2 flex items-center">
        <strong className="text-sm">Commands</strong>

        <CustomTooltip
          title={
            <>
              Custom command use when executing container.
              <br />
              <br />
              An example and popular use case is to run a bash script to install packages or run specific commands.
            </>
          }
        >
          <InfoCircle className="ml-2 text-xs text-muted-foreground" />
        </CustomTooltip>

        <span
          className="ml-4 cursor-pointer text-sm font-normal text-primary underline"
          onClick={() => setIsEditingCommands(serviceIndex !== undefined ? serviceIndex : true)}
        >
          Edit
        </span>
      </div>

      {(currentService.command?.command.length || 0) > 0 ? (
        <div className="whitespace-pre-wrap text-xs">
          <div>{currentService.command?.command}</div>
          <div className="text-muted-foreground">{currentService.command?.arg}</div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">None</p>
      )}
    </FormPaper>
  );
};
