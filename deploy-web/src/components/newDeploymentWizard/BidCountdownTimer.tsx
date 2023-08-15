import React, { useEffect, useState } from "react";
import { useBlock } from "@src/queries/useBlocksQuery";
import { differenceInSeconds } from "date-fns";
import { Alert, Chip, Typography } from "@mui/material";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";

type Props = {
  height: string;
};

// 5 minutes
const time = 5 * 60;

export const BidCountdownTimer: React.FunctionComponent<Props> = ({ height }) => {
  const [timeLeft, setTimeLeft] = useState(time); // Set the initial time in seconds
  const [isTimerInit, setIsTimerInit] = useState(false);
  const { data: block, refetch: getBlock } = useBlock(height, {
    disabled: true,
    onSuccess: block => {
      const date = new Date(block.block.header.time);
      const now = new Date();
      // add 20 seconds for the delay between deployment creation and bid creation
      const diff = Math.max(0, time - differenceInSeconds(now, date) + 20);
      setTimeLeft(diff);
      setIsTimerInit(true);
    }
  });

  useEffect(() => {
    getBlock();
  }, []);

  useEffect(() => {
    // Exit early when we reach 0
    if (!timeLeft) return;

    // Save intervalId to clear the interval when the component unmounts
    const intervalId = setInterval(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    // Clear interval on unmount
    return () => clearInterval(intervalId);
  }, [timeLeft, block]);

  // Calculate the minutes and seconds
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  // Format the minutes and seconds to display as 2 digits
  const formattedMinutes = minutes < 10 ? "0" + minutes : minutes;
  const formattedSeconds = seconds < 10 ? "0" + seconds : seconds;

  if (!isTimerInit) return null;

  return (
    <Chip
      size="small"
      color={timeLeft === 0 ? "default" : "secondary"}
      variant="outlined"
      label={
        <Typography variant="caption" sx={{ display: "inline-flex", alignItems: "center" }}>
          {timeLeft === 0 ? (
            <>Time's up!</>
          ) : (
            <>
              Time Remaining: {formattedMinutes}:{formattedSeconds}
            </>
          )}

          <CustomTooltip
            arrow
            title={
              <Alert severity="info" variant="outlined">
                Bids automatically close 5 minutes after the deployment is created if none are selected for a lease.
              </Alert>
            }
          >
            <InfoIcon fontSize="small" sx={{ fontSize: ".9rem", marginLeft: ".5rem" }} />
          </CustomTooltip>
        </Typography>
      }
    />
  );
};
