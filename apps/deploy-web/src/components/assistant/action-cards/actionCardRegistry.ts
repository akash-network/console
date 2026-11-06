import { AddRuntimeHoursCard } from "./AddRuntimeHoursCard/AddRuntimeHoursCard";
import { BuyCreditsCard } from "./BuyCreditsCard/BuyCreditsCard";
import { CloseDeploymentCard } from "./CloseDeploymentCard/CloseDeploymentCard";
import { ConfigureAutoRechargeCard } from "./ConfigureAutoRechargeCard/ConfigureAutoRechargeCard";
import { CreateAlertCard } from "./CreateAlertCard/CreateAlertCard";
import { FavoriteProviderCard } from "./FavoriteProviderCard/FavoriteProviderCard";
import { MoveDeploymentCard } from "./MoveDeploymentCard/MoveDeploymentCard";
import { RedeemCouponCard } from "./RedeemCouponCard/RedeemCouponCard";
import { RemoveRuntimeLimitCard } from "./RemoveRuntimeLimitCard/RemoveRuntimeLimitCard";
import { RenameDeploymentCard } from "./RenameDeploymentCard/RenameDeploymentCard";
import { RequestHardwareCard } from "./RequestHardwareCard/RequestHardwareCard";
import { SaveAsTemplateCard } from "./SaveAsTemplateCard/SaveAsTemplateCard";
import { SendManifestAgainCard } from "./SendManifestAgainCard/SendManifestAgainCard";
import type { ActionCardRegistry } from "./actionCardTypes";

/** One card per action type; an action missing here falls back to `GenericActionCard`. */
export const ACTION_CARD_REGISTRY: ActionCardRegistry = {
  send_manifest_again: SendManifestAgainCard,
  buy_credits: BuyCreditsCard,
  rename_deployment: RenameDeploymentCard,
  move_deployment: MoveDeploymentCard,
  add_runtime_hours: AddRuntimeHoursCard,
  remove_runtime_limit: RemoveRuntimeLimitCard,
  close_deployment: CloseDeploymentCard,
  create_alert: CreateAlertCard,
  redeem_coupon: RedeemCouponCard,
  save_as_template: SaveAsTemplateCard,
  favorite_provider: FavoriteProviderCard,
  request_hardware: RequestHardwareCard,
  configure_auto_recharge: ConfigureAutoRechargeCard
};
