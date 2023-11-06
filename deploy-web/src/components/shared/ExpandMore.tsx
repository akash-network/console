import { IconButton, IconButtonProps, styled } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

interface ExpandMoreButtonProps extends IconButtonProps {
  expand: boolean;
}

export const ExpandMoreButton = styled((props: ExpandMoreButtonProps) => {
  const { expand, children, ...other } = props;
  return (
    <IconButton {...other}>
      <ExpandMoreIcon />
    </IconButton>
  );
})(({ theme, expand }) => ({
  transform: !expand ? "rotate(0deg)" : "rotate(180deg)",
  marginLeft: "auto",
  transition: theme.transitions.create("transform", {
    duration: theme.transitions.duration.shortest
  })
}));

interface ExpandMoreProps {
  expand: boolean;
}

export const ExpandMore = styled((props: ExpandMoreProps) => {
  const { expand, ...other } = props;
  return <ExpandMoreIcon {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? "rotate(0deg)" : "rotate(180deg)",
  marginLeft: "auto",
  transition: theme.transitions.create("transform", {
    duration: theme.transitions.duration.shortest
  })
}));
