import StarBorderIcon from "@mui/icons-material/StarBorder";
import StarIcon from "@mui/icons-material/Star";
import { IconButton } from "@mui/material";

export const FavoriteButton = ({ onClick, isFavorite }) => {
  return (
    <IconButton onClick={onClick} size="small">
      {isFavorite ? <StarIcon fontSize="small" color="secondary" /> : <StarBorderIcon fontSize="small" color="disabled" />}
    </IconButton>
  );
};
