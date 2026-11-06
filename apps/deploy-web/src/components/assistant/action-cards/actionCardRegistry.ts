import { AddRuntimeHoursCard } from "./AddRuntimeHoursCard/AddRuntimeHoursCard";
import { BuyCreditsCard } from "./BuyCreditsCard/BuyCreditsCard";
import { ChooseBidCard } from "./ChooseBidCard/ChooseBidCard";
import { CloseDeploymentCard } from "./CloseDeploymentCard/CloseDeploymentCard";
import { ConfigureAutoRechargeCard } from "./ConfigureAutoRechargeCard/ConfigureAutoRechargeCard";
import { CreateAlertCard } from "./CreateAlertCard/CreateAlertCard";
import { CreateDeploymentCard } from "./CreateDeploymentCard/CreateDeploymentCard";
import { EditConfigureFormCard } from "./EditConfigureFormCard/EditConfigureFormCard";
import { FavoriteProviderCard } from "./FavoriteProviderCard/FavoriteProviderCard";
import { MoveDeploymentCard } from "./MoveDeploymentCard/MoveDeploymentCard";
import { OpenInEditorCard } from "./OpenInEditorCard/OpenInEditorCard";
import { withPricingGuard } from "./PricingRefusalCard/PricingRefusalCard";
import { RedeemCouponCard } from "./RedeemCouponCard/RedeemCouponCard";
import { RedeployWithResourcesCard } from "./RedeployWithResourcesCard/RedeployWithResourcesCard";
import { RemoveRuntimeLimitCard } from "./RemoveRuntimeLimitCard/RemoveRuntimeLimitCard";
import { RenameDeploymentCard } from "./RenameDeploymentCard/RenameDeploymentCard";
import { RequestHardwareCard } from "./RequestHardwareCard/RequestHardwareCard";
import { SaveAsTemplateCard } from "./SaveAsTemplateCard/SaveAsTemplateCard";
import { SendManifestAgainCard } from "./SendManifestAgainCard/SendManifestAgainCard";
import { SetRegistryCredentialsCard } from "./SetRegistryCredentialsCard/SetRegistryCredentialsCard";
import { SetSecretCard } from "./SetSecretCard/SetSecretCard";
import { UpdateDeploymentCard } from "./UpdateDeploymentCard/UpdateDeploymentCard";
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
  configure_auto_recharge: ConfigureAutoRechargeCard,
  edit_configure_form: EditConfigureFormCard,
  create_deployment: withPricingGuard(CreateDeploymentCard),
  choose_bid: withPricingGuard(ChooseBidCard),
  update_deployment: withPricingGuard(UpdateDeploymentCard),
  set_secret: withPricingGuard(SetSecretCard),
  set_registry_credentials: withPricingGuard(SetRegistryCredentialsCard),
  redeploy_with_resources: withPricingGuard(RedeployWithResourcesCard),
  open_in_editor: withPricingGuard(OpenInEditorCard)
};
