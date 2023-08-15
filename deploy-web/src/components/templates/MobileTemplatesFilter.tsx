import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import React, { ReactNode } from "react";
import { makeStyles } from "tss-react/mui";
import { IconButton, List, ListItemButton, ListItemText, Typography, useMediaQuery } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { ApiTemplate } from "@src/types";

const useStyles = makeStyles()(theme => ({}));

type Props = {
  children?: ReactNode;
  isOpen: boolean;
  handleDrawerToggle: () => void;
  categories: Array<{ title: string; templates: Array<ApiTemplate> }>;
  templates: Array<ApiTemplate>;
  selectedCategoryTitle: string;
  onCategoryClick: (categoryTitle: string) => void;
};

export const MobileTemplatesFilter: React.FunctionComponent<Props> = ({
  isOpen,
  handleDrawerToggle,
  templates,
  categories,
  selectedCategoryTitle,
  onCategoryClick
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const smallScreen = useMediaQuery(theme.breakpoints.down("md"));

  return (
    <Drawer
      anchor="bottom"
      variant="temporary"
      open={isOpen}
      onClose={handleDrawerToggle}
      ModalProps={{
        keepMounted: true // Better open performance on mobile.
      }}
      sx={{
        "& .MuiDrawer-paper": { boxSizing: "border-box", overflow: "hidden", maxHeight: `60%`, wdith: "100%" }
      }}
      PaperProps={{
        sx: {
          border: "none"
        }
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="body1" sx={{ fontSize: "1.25rem", padding: ".5rem" }}>
          Filter Templates
        </Typography>

        <IconButton onClick={handleDrawerToggle} size="medium" sx={{ marginRight: ".5rem" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <List sx={{ overflowY: "scroll" }}>
        {templates && (
          <ListItemButton onClick={() => onCategoryClick(null)} selected={!selectedCategoryTitle} sx={{ padding: ".5rem 1rem" }} dense>
            <ListItemText primary={`All (${templates.length - 1})`} />
          </ListItemButton>
        )}

        {categories
          .sort((a, b) => (a.title < b.title ? -1 : 1))
          .map(category => (
            <ListItemButton
              key={category.title}
              onClick={() => onCategoryClick(category.title)}
              selected={category.title === selectedCategoryTitle}
              sx={{ padding: ".5rem 1rem" }}
              dense
            >
              <ListItemText primary={`${category.title} (${category.templates.length})`} />
            </ListItemButton>
          ))}
      </List>
    </Drawer>
  );
};
