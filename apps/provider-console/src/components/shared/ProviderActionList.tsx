import React from "react";
import { Box, List, ListItem, Typography, Grid } from "@mui/material";
import { Check, PlayArrow, Error } from "@mui/icons-material";
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

const ProviderActionList: React.FC<ProviderActionListProps> = ({ actions }) => {
  const router = useRouter();

  const getStatusIcon = (status: ProviderAction["status"]) => {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

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
                  {getStatusIcon(action.status)}
                </Grid>
              </Grid>
            </ListItem>
          ))
        ) : (
          <ListItem
            sx={{
              borderBottom: "1px solid #eee",
              py: 2,
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

export default ProviderActionList;
