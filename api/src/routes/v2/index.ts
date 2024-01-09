/** Reused Implementations (v1) */
import predictedDateHeight from "../v1/predictedDateHeight";
import transactions from "../v1/transactions/list";
import transactionByHash from "../v1/transactions/byHash";
import address from "../v1/addresses/address";

/** New Implementations (v2) */
import predictedBlockDate from "./predictedBlockDate";

export default [predictedBlockDate, predictedDateHeight, transactions, transactionByHash, address];
