"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSHKeyFormControl = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var file_saver_1 = require("file-saver");
var iconoir_react_1 = require("iconoir-react");
var CodeSnippet_1 = require("@src/components/shared/CodeSnippet");
var SdlBuilderProvider_1 = require("@src/context/SdlBuilderProvider/SdlBuilderProvider");
var sshKeyUtils_1 = require("@src/utils/sshKeyUtils");
var SSHKeyFormControl = function (_a) {
    var control = _a.control, serviceIndex = _a.serviceIndex, setValue = _a.setValue;
    var imageList = (0, SdlBuilderProvider_1.useSdlBuilder)().imageList;
    var _b = (0, react_1.useState)(false), hasGenerated = _b[0], setHasGenerated = _b[1];
    var generateSSHKeys = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, publicKey, privateKey, JSZipModule, JSZip, zip, content;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = (0, sshKeyUtils_1.generateSSHKeyPair)(), publicKey = _a.publicKey, privateKey = _a.privateKey;
                    setValue("services.".concat(serviceIndex, ".sshPubKey"), publicKey);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("jszip"); })];
                case 1:
                    JSZipModule = _b.sent();
                    JSZip = JSZipModule.default || JSZipModule;
                    zip = new JSZip();
                    zip.file("id_rsa.pub", publicKey);
                    zip.file("id_rsa", privateKey);
                    return [4 /*yield*/, zip.generateAsync({ type: "blob" })];
                case 2:
                    content = _b.sent();
                    (0, file_saver_1.saveAs)(content, "keypair.zip");
                    setHasGenerated(true);
                    return [2 /*return*/];
            }
        });
    }); }, [serviceIndex, setValue]);
    return (<div>
      <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".sshPubKey")} render={function (_a) {
            var field = _a.field;
            return (<components_1.FormInput type="text" label={<div className="inline-flex items-center">
                <strong>SSH Public Key</strong>
                <components_1.CustomTooltip title={<>
                      SSH Public Key
                      <br />
                      <br />
                      The key is added to environment variables of the container and then to ~/.ssh/authorized_keys on startup.
                    </>}>
                  <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                </components_1.CustomTooltip>
              </div>} placeholder="Enter your own pub key: ssh-.." className="flex-grow" inputClassName="pr-[100px]" value={field.value} onChange={function (event) { return field.onChange(event.target.value || ""); }} startIcon={<iconoir_react_1.Key className="ml-2 text-xs text-muted-foreground"/>} data-testid="ssh-public-key-input"/>);
        }}/>

      <div className="mt-2 flex items-center justify-end space-x-2">
        <span className="text-sm text-muted-foreground">Or</span>
        <components_1.Button onClick={generateSSHKeys} type="button" size="xs" data-testid="generate-ssh-keys-btn">
          Generate new key
        </components_1.Button>
      </div>

      {hasGenerated && (<div className="mt-2 text-sm text-muted-foreground">
          <h4 className="text-lg">How to use</h4>
          <p className="mt-2">The generated SSH key pair is used to access the container via SSH. Here are generalized steps to use them:</p>
          <ul className="list-inside list-disc space-y-1 text-gray-500 dark:text-gray-400">
            <li>
              Download the key pair and extract it.
              <CodeSnippet_1.CodeSnippet code="unzip ~/Downloads/keypair.zip"/>
            </li>
            <li>
              Copy the private key file to <code>~/.ssh/id_rsa</code> on your local machine.
              <CodeSnippet_1.CodeSnippet code="mv ~/Downloads/keypair/* ~/.ssh/"/>
            </li>
            <li>
              Make sure to set the correct permissions on the private key file:
              <CodeSnippet_1.CodeSnippet code="chmod 600 ~/.ssh/id_rsa"/>
            </li>
            <li>Check out more instructions on deployment page in the Lease tab.</li>
          </ul>
          <p className="mt-2">Note: the above is valid for unix operating system</p>
          {!imageList && <p className="mt-2">Note: make sure your image has ssh configured</p>}
        </div>)}
    </div>);
};
exports.SSHKeyFormControl = SSHKeyFormControl;
