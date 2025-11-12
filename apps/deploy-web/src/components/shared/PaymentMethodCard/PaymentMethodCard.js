"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentMethodCard = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var PaymentMethodCard = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    var method = _a.method, isRemoving = _a.isRemoving, onRemove = _a.onRemove, _m = _a.isSelectable, isSelectable = _m === void 0 ? false : _m, _o = _a.isSelected, isSelected = _o === void 0 ? false : _o, onSelect = _a.onSelect, _p = _a.showValidationBadge, showValidationBadge = _p === void 0 ? true : _p, _q = _a.isTrialing, isTrialing = _q === void 0 ? false : _q;
    var handleCardClick = function () {
        if (isSelectable && onSelect) {
            onSelect(method.id);
        }
    };
    var handleRemoveClick = function (e) {
        e.stopPropagation();
        onRemove(method.id);
    };
    if (isSelectable) {
        // Selection mode - used in payment page
        return (<div className={"flex cursor-pointer items-center justify-between rounded-md border p-4 transition-colors ".concat(isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50")} onClick={handleCardClick}>
        <div className="flex items-center gap-3">
          <components_1.RadioGroupItem value={method.id} id={method.id}/>
          <div className="flex items-center gap-3">
            <div>
              <div className="text-base font-medium">
                {(_c = (_b = method.card) === null || _b === void 0 ? void 0 : _b.brand) === null || _c === void 0 ? void 0 : _c.toUpperCase()} •••• {(_d = method.card) === null || _d === void 0 ? void 0 : _d.last4}
              </div>
              <div className="text-sm text-muted-foreground">
                Expires {(_e = method.card) === null || _e === void 0 ? void 0 : _e.exp_month}/{(_f = method.card) === null || _f === void 0 ? void 0 : _f.exp_year}
              </div>
            </div>
          </div>
        </div>
        {!isTrialing && (<components_1.Button variant="ghost" size="sm" onClick={handleRemoveClick} disabled={isRemoving}>
            Remove
          </components_1.Button>)}
      </div>);
    }
    // Display mode - used in onboarding
    return (<components_1.Card className="relative">
      <components_1.CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <iconoir_react_1.CreditCard className="h-5 w-5 text-primary"/>
            </div>
            <div>
              <components_1.CardTitle className="text-left text-base">
                {(_h = (_g = method.card) === null || _g === void 0 ? void 0 : _g.brand) === null || _h === void 0 ? void 0 : _h.toUpperCase()} •••• {(_j = method.card) === null || _j === void 0 ? void 0 : _j.last4}
              </components_1.CardTitle>
              <components_1.CardDescription>
                Expires {(_k = method.card) === null || _k === void 0 ? void 0 : _k.exp_month}/{(_l = method.card) === null || _l === void 0 ? void 0 : _l.exp_year}
              </components_1.CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showValidationBadge && method.validated && (<components_1.Badge variant="success" className="flex items-center p-1">
                <iconoir_react_1.CheckCircle className="h-4 w-4"/>
              </components_1.Badge>)}
            <components_1.Button onClick={handleRemoveClick} variant="ghost" size="sm" disabled={isRemoving} className="text-muted-foreground">
              Remove
            </components_1.Button>
          </div>
        </div>
      </components_1.CardHeader>
    </components_1.Card>);
};
exports.PaymentMethodCard = PaymentMethodCard;
