import axios from "axios";
import { BASE_API_URL } from "./constants";

export class ApiUrlService {
  static mainnetVersion() {
    return `0.36.0`;
  }
  static testnetVersion() {
    return `0.36.0`;
  }
  static sandboxVersion() {
    return `0.36.0`;
  }

  static mainnetNodes() {
    return `${BASE_API_URL}/v1/nodes/mainnet`;
  }
  static testnetNodes() {
    return `${BASE_API_URL}/v1/nodes/testnet`;
  }
  static sandboxNodes() {
    return `${BASE_API_URL}/v1/nodes/sandbox`;
  }
  static depositParams(apiEndpoint: string) {
    return `${apiEndpoint}/cosmos/params/v1beta1/params?subspace=deployment&key=MinDeposits`;
  }
  static marketData() {
    return `${BASE_API_URL}/v1/market-data`;
  }
}

export const mainnetNodes = ApiUrlService.mainnetNodes();
export const testnetNodes = ApiUrlService.testnetNodes();
export const sandboxNodes = ApiUrlService.sandboxNodes();