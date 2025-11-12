"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyList = ApiKeyList;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var ApiKeyDocsBanner_1 = require("@src/components/api-keys/ApiKeyDocsBanner");
var CreateApiKeyModal_1 = require("@src/components/api-keys/CreateApiKeyModal");
var VerifiedPayingCustomerRequiredLink_1 = require("@src/components/user/VerifiedPayingCustomerRequiredLink");
var WalletProvider_1 = require("@src/context/WalletProvider");
function ApiKeyList(_a) {
    var _b;
    var apiKeys = _a.apiKeys, onDeleteApiKey = _a.onDeleteApiKey, onDeleteClose = _a.onDeleteClose, isDeleting = _a.isDeleting, apiKeyToDelete = _a.apiKeyToDelete, updateApiKeyToDelete = _a.updateApiKeyToDelete;
    var _c = (0, WalletProvider_1.useWallet)(), isTrialing = _c.isTrialing, isManaged = _c.isManaged;
    var _d = (0, react_1.useState)(false), isCreateModalOpen = _d[0], setIsCreateModalOpen = _d[1];
    return (<>
      {isCreateModalOpen && <CreateApiKeyModal_1.CreateApiKeyModal isOpen={isCreateModalOpen} onClose={function () { return setIsCreateModalOpen(false); }}/>}
      {!!apiKeyToDelete && (<components_1.Popup fullWidth variant="custom" actions={[
                {
                    label: "Close",
                    color: "primary",
                    variant: "secondary",
                    side: "left",
                    onClick: onDeleteClose
                },
                {
                    label: "Confirm",
                    color: "secondary",
                    variant: "default",
                    side: "right",
                    disabled: isDeleting,
                    isLoading: isDeleting,
                    onClick: function () { return onDeleteApiKey(apiKeyToDelete); }
                }
            ]} onClose={onDeleteClose} maxWidth="sm" enableCloseOnBackdropClick open={!!apiKeyToDelete} title="Delete API Key">
          Are you sure you want to delete API Key: <b>{apiKeyToDelete === null || apiKeyToDelete === void 0 ? void 0 : apiKeyToDelete.name}</b>?
        </components_1.Popup>)}

      <div className="py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">API Keys</h1>
          </div>
          <VerifiedPayingCustomerRequiredLink_1.VerifiedPayingCustomerRequiredLink onClick={function () { return setIsCreateModalOpen(true); }}>
            <components_1.Button>Create Key</components_1.Button>
          </VerifiedPayingCustomerRequiredLink_1.VerifiedPayingCustomerRequiredLink>
        </div>

        <div className="rounded-lg bg-card p-4">
          <components_1.Table>
            <components_1.TableHeader>
              <components_1.TableRow>
                <components_1.TableHead className="w-2/12">Name</components_1.TableHead>
                <components_1.TableHead className="w-4/12">Key</components_1.TableHead>
                <components_1.TableHead className="w-4/12">Created</components_1.TableHead>
                <components_1.TableHead className="w-4/12">Last Used</components_1.TableHead>
                <components_1.TableHead className="w-1/12"></components_1.TableHead>
              </components_1.TableRow>
            </components_1.TableHeader>
            <components_1.TableBody>
              {(_b = apiKeys === null || apiKeys === void 0 ? void 0 : apiKeys.sort(function (a, b) { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); })) === null || _b === void 0 ? void 0 : _b.map(function (key) { return (<components_1.TableRow key={key.id}>
                    <components_1.TableCell>{key.name}</components_1.TableCell>
                    <components_1.TableCell>{key.keyFormat}</components_1.TableCell>
                    <components_1.TableCell>
                      <react_intl_1.FormattedDate value={key.createdAt} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit"/>
                    </components_1.TableCell>
                    <components_1.TableCell>
                      {key.lastUsedAt ? (<react_intl_1.FormattedDate value={key.lastUsedAt} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit"/>) : ("Never")}
                    </components_1.TableCell>
                    <components_1.TableCell>
                      <components_1.Button variant="default" size="icon" className="h-8 w-8 rounded-full text-xs" onClick={function () { return updateApiKeyToDelete(key); }}>
                        <iconoir_react_1.Trash />
                      </components_1.Button>
                    </components_1.TableCell>
                  </components_1.TableRow>); })}

              {((apiKeys === null || apiKeys === void 0 ? void 0 : apiKeys.length) === 0 || isTrialing || !isManaged) && (<components_1.TableRow>
                  <components_1.TableCell colSpan={5} className="text-center">
                    No API keys found
                  </components_1.TableCell>
                </components_1.TableRow>)}
            </components_1.TableBody>
          </components_1.Table>
        </div>

        <div className="mt-6">
          <ApiKeyDocsBanner_1.ApiKeyDocsBanner />
        </div>
      </div>
    </>);
}
