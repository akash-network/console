import { singleton } from "tsyringe";

@singleton()
export class ChainErrorService {
  private readonly CHAIN_ERROR_STATUS_CODES: Record<string, number> = {
    "insufficient funds": 400,
    "deposit too low": 400,
    "deployment closed": 400,
    "invalid coin denominations": 400,
    "invalid gpu attributes": 400,
    "invalid: deployment version": 400,
    "invalid: deployment hash": 400,
    "fee allowance expired": 400,
    "deployment exists": 400,
    "invalid owner address": 400,
    "bid not open": 400,
    "order not open": 400,
    "invalid unit price": 400,
    "insufficient balance": 402,
    "bad status on response: 502": 503,
    "bad status on response: 503": 503,
    "bad status on response: 504": 503
  };

  getChainErrorStatus(message: string): number | undefined {
    const lowerMessage = message.toLowerCase();

    for (const [pattern, status] of Object.entries(this.CHAIN_ERROR_STATUS_CODES)) {
      if (lowerMessage.includes(pattern)) {
        return status;
      }
    }

    return undefined;
  }
}
