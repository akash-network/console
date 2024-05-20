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
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadWithPagination = void 0;
function loadWithPagination(baseUrl, dataKey, limit) {
    return __awaiter(this, void 0, void 0, function* () {
        let items = [];
        let nextKey = null;
        let callCount = 1;
        let totalCount = null;
        do {
            let queryUrl = baseUrl + "?pagination.limit=" + limit + "&pagination.count_total=true";
            if (nextKey) {
                queryUrl += "&pagination.key=" + encodeURIComponent(nextKey);
            }
            console.log(`Querying ${dataKey} [${callCount}] from : ${queryUrl}`);
            const response = yield fetch(queryUrl);
            const data = yield response.json();
            if (!nextKey) {
                totalCount = data.pagination.total;
            }
            items = items.concat(data[dataKey]);
            nextKey = data.pagination.next_key;
            callCount++;
            console.log(`Got ${items.length} of ${totalCount}`);
        } while (nextKey);
        return items.filter((item) => item);
    });
}
exports.loadWithPagination = loadWithPagination;
//# sourceMappingURL=query.js.map