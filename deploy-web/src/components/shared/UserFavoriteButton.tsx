import React, { ReactNode, useState } from "react";
import { CircularProgress, IconButton } from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import { useAddFavoriteTemplate, useRemoveFavoriteTemplate } from "@src/queries/useTemplateQuery";
import { Snackbar } from "./Snackbar";
import { useSnackbar } from "notistack";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { MustConnectModal } from "./MustConnectModal";

type Props = {
  id: string;
  isFavorite: boolean;
  children?: ReactNode;
  onAddFavorite?: () => void;
  onRemoveFavorite?: () => void;
};

export const UserFavoriteButton: React.FunctionComponent<Props> = ({ id, isFavorite: _isFavorite, onAddFavorite, onRemoveFavorite }) => {
  const { user } = useCustomUser();
  const [isFavorite, setIsFavorite] = useState(_isFavorite);
  const { mutate: addFavorite, isLoading: isAdding } = useAddFavoriteTemplate(id);
  const { mutate: removeFavorite, isLoading: isRemoving } = useRemoveFavoriteTemplate(id);
  const [showMustConnectModal, setShowMustConnectModal] = useState(false);
  const isSaving = isAdding || isRemoving;
  const { enqueueSnackbar } = useSnackbar();

  const onFavoriteClick = async () => {
    try {
      if (isSaving) return;
      if (!user) {
        setShowMustConnectModal(true);
        return;
      }

      if (isFavorite) {
        await removeFavorite();
        onRemoveFavorite && onRemoveFavorite();
      } else {
        await addFavorite();
        onAddFavorite && onAddFavorite();
      }

      setIsFavorite(prev => !prev);
    } catch (error) {
      console.log(error);
      enqueueSnackbar(<Snackbar title="An error has occured." iconVariant="error" />, {
        variant: "error"
      });
    }
  };

  return (
    <>
      {showMustConnectModal && <MustConnectModal message="To add template favorites" onClose={() => setShowMustConnectModal(false)} />}
      <IconButton size="small" onClick={onFavoriteClick} color={isFavorite ? "secondary" : "default"}>
        {isSaving ? <CircularProgress size="1.5rem" color="secondary" /> : isFavorite ? <StarIcon /> : <StarOutlineIcon />}
      </IconButton>
    </>
  );
};
