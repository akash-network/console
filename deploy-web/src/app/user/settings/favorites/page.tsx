import { Metadata } from "next";
import { UserFavorites } from "./UserFavorites";

export const metadata: Metadata = {
  title: "User Favorites"
};

export default async function TemplateDetailPage() {
  return <UserFavorites />;
}
