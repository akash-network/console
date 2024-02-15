"use client";
import { Dispatch, ReactNode, SetStateAction } from "react";
import { Service } from "@src/types";
import { CustomTooltip } from "../shared/CustomTooltip";
import { FormPaper } from "./FormPaper";
import { InfoCircle } from "iconoir-react";
import { cn } from "@src/utils/styleUtils";

type Props = {
  currentService: Service;
  serviceIndex?: number;
  children?: ReactNode;
  setIsEditingExpose: Dispatch<SetStateAction<boolean | number>>;
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

export const ExposeList: React.FunctionComponent<Props> = ({ currentService, setIsEditingExpose, serviceIndex }) => {
  return (
    <FormPaper className="px-4 py-2">
      <div className="mb-2 flex items-center">
        <p>
          <strong>Expose</strong>
        </p>

        <CustomTooltip
          title={
            <>
              Expose is a list of port settings describing what can connect to the service.
              <br />
              <br />
              <a href="https://docs.akash.network/readme/stack-definition-language#services.expose" target="_blank" rel="noopener">
                View official documentation.
              </a>
            </>
          }
        >
          <InfoCircle className="ml-4 text-sm text-muted-foreground" />
        </CustomTooltip>

        <span
          className="ml-4 cursor-pointer text-sm font-normal text-primary-foreground underline"
          onClick={() => setIsEditingExpose(serviceIndex !== undefined ? serviceIndex : true)}
        >
          Edit
        </span>
      </div>

      {currentService.expose?.map((exp, i) => (
        <div
          key={i}
          className={cn("text-xs", { ["mb-2"]: i + 1 !== currentService.expose.length })}
          // sx={{ fontSize: ".75rem", marginBottom: i + 1 === currentService.expose.length ? 0 : ".5rem" }}
        >
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
