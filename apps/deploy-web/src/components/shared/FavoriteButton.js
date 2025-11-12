"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavoriteButton = void 0;
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var FavoriteButton = function (_a) {
    var onClick = _a.onClick, isFavorite = _a.isFavorite;
    return (<components_1.Button onClick={onClick} size="icon" className="h-8 w-8 rounded-full" variant="ghost">
      {isFavorite ? <iconoir_react_1.StarSolid className="text-xs text-primary"/> : <iconoir_react_1.Star className="text-xs text-muted-foreground"/>}
    </components_1.Button>);
};
exports.FavoriteButton = FavoriteButton;
