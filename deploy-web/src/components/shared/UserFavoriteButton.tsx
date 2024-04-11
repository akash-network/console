import React, { ReactNode, useState } from "react";
import { useAddFavoriteTemplate, useRemoveFavoriteTemplate } from "@src/queries/useTemplateQuery";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { MustConnectModal } from "./MustConnectModal";
import { Button } from "../ui/button";
import Spinner from "./Spinner";
import { MdStar, MdStarOutline } from "react-icons/md";
import { useToast } from "../ui/use-toast";

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
  const { toast } = useToast();

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
      toast({ title: "An error has occured.", variant: "destructive" });
    }
  };

  return (
    <>
      {showMustConnectModal && <MustConnectModal message="To add template favorites" onClose={() => setShowMustConnectModal(false)} />}
      <Button size="icon" onClick={onFavoriteClick} color={isFavorite ? "secondary" : "default"}>
        {isSaving ? <Spinner size="small" /> : isFavorite ? <MdStar /> : <MdStarOutline />}
      </Button>
    </>
  );
};
