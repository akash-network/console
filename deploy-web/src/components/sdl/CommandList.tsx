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

// const useStyles = makeStyles()(theme => ({
//   editLink: {
//     color: theme.palette.secondary.light,
//     textDecoration: "underline",
//     cursor: "pointer",
//     fontWeight: "normal",
//     fontSize: ".8rem"
//   },
//   formValue: {
//     color: theme.palette.grey[500]
//   }
// }));

export const CommandList: React.FunctionComponent<Props> = ({ currentService, setIsEditingCommands, serviceIndex }) => {
  // const { classes } = useStyles();

  return (
    <FormPaper>
      <div className="mb-2 flex items-center">
        <p>
          <strong>Commands</strong>
        </p>

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
          <InfoCircle className="ml-4 text-sm text-muted-foreground" />
        </CustomTooltip>

        <span
          className="ml-4 cursor-pointer text-sm font-normal text-primary-foreground underline"
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
