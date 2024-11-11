import React from "react";
import { useCallback } from "react";
import { Check, Error, PlayArrow } from "@mui/icons-material";
import { Box, Grid, List, ListItem, Typography } from "@mui/material";
import { useRouter } from "next/router";

interface ProviderAction {
  id: string;
  name: string;
  status: "completed" | "in_progress" | "pending" | "failed";
  start_time: string;
  end_time?: string;
}

interface ProviderActionListProps {
  actions: ProviderAction[];
}

interface StatusIconProps {
  status: ProviderAction["status"];
}

const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
  switch (status) {
    case "completed":
      return <Check color="success" />;
    case "in_progress":
      return <PlayArrow color="primary" />;
    case "failed":
      return <Error color="error" />;
    default:
      return <Box sx={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #ccc" }} />;
  }
};

export const ProviderActionList: React.FC<ProviderActionListProps> = ({ actions }) => {
  const router = useRouter();

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString + "Z");

    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short"
    });
  }, []);

  const calculateTimeLapse = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const timeLapse = endTime - startTime;
    return `${Math.floor(timeLapse / 1000)} seconds`;
  };

  const handleRowClick = (actionId: string) => {
    router.push(`/action-details/?id=${actionId}`);
  };

  return (
    <Box sx={{ width: "100%" }}>
      <List>
        {actions.length > 0 ? (
          actions.map(action => (
            <ListItem
              key={action.id}
              sx={{
                borderBottom: "1px solid #eee",
                py: 2,
                cursor: "pointer",
                "&:hover": { backgroundColor: "#f5f5f5" }
              }}
              onClick={() => handleRowClick(action.id)}
            >
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={4}>
                  <Typography variant="subtitle1">{action.name}</Typography>
                </Grid>
                <Grid item xs={2}>
                  <Typography variant="body2" color="text.secondary">
                    {calculateTimeLapse(action.start_time, action.end_time)}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(action.start_time)}
                  </Typography>
                </Grid>
                <Grid item xs={2} sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <StatusIcon status={action.status} />
                </Grid>
              </Grid>
            </ListItem>
          ))
        ) : (
          <ListItem
            sx={{
              borderBottom: "1px solid #eee",
              py: 2
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12}>
                <Typography variant="body1" color="text.secondary">
                  No recent actions to display.
                </Typography>
              </Grid>
            </Grid>
          </ListItem>
        )}
      </List>
    </Box>
  );
};
