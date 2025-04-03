import React from "react";
import type { StepIconProps } from "@mui/material";
import { StepConnector, stepConnectorClasses, styled } from "@mui/material";
import { Check } from "iconoir-react";

export const QontoConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 10,
    left: "calc(-50% + 16px)",
    right: "calc(50% + 16px)"
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.primary.main
    }
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.primary.main
    }
  }
}));

const QontoStepIconRoot = styled("div")<{ ownerState: { active?: boolean } }>(({ theme, ownerState }) => ({
  color: theme.palette.mode === "dark" ? theme.palette.grey[700] : "#eaeaf0",
  display: "flex",
  height: 22,
  alignItems: "center",
  ...(ownerState.active && {
    color: theme.palette.primary.main
  }),
  "& .QontoStepIcon-completedIcon": {
    color: theme.palette.primary.main,
    zIndex: 1,
    fontSize: 18,
    marginLeft: "4px"
  },
  "& .QontoStepIcon-circle": {
    width: 8,
    height: 8,
    marginLeft: "8px",
    borderRadius: "50%",
    backgroundColor: "currentColor"
  }
}));

export function QontoStepIcon(props: StepIconProps) {
  const { active, completed, className } = props;

  return (
    <QontoStepIconRoot ownerState={{ active }} className={className}>
      {completed ? <Check className="QontoStepIcon-completedIcon" /> : <div className="QontoStepIcon-circle" />}
    </QontoStepIconRoot>
  );
}
