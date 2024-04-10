import { Metadata } from "next";
import { SettingsContainer } from "./SettingsContainer";

export const metadata: Metadata = {
  title: "Settings"
};

export default function Settings() {
  return <SettingsContainer />;
}
