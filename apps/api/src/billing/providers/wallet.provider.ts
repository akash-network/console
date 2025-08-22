import { container, inject } from "tsyringe";

import { config } from "@src/billing/config";
import { Wallet } from "@src/billing/lib/wallet/wallet";
import type { MasterWalletType } from "@src/billing/types/wallet.type";

export const MANAGED_MASTER_WALLET = "MANAGED_MASTER_WALLET";
export const UAKT_TOP_UP_MASTER_WALLET = "UAKT_TOP_UP_MASTER_WALLET";
export const USDC_TOP_UP_MASTER_WALLET = "USDC_TOP_UP_MASTER_WALLET";
export const COMPANY_MASTER_WALLET = "COMPANY_MASTER_WALLET";
export const COMMUNITY_MASTER_WALLET = "COMMUNITY_MASTER_WALLET";

// Legacy wallet registration (for backward compatibility)
if (config.MASTER_WALLET_MNEMONIC) {
  container.register(MANAGED_MASTER_WALLET, { useFactory: () => new Wallet(config.MASTER_WALLET_MNEMONIC) });
}

container.register(UAKT_TOP_UP_MASTER_WALLET, { useFactory: () => new Wallet(config.UAKT_TOP_UP_MASTER_WALLET_MNEMONIC) });
container.register(USDC_TOP_UP_MASTER_WALLET, { useFactory: () => new Wallet(config.USDC_TOP_UP_MASTER_WALLET_MNEMONIC) });

// New multi-wallet registration
container.register(COMPANY_MASTER_WALLET, { useFactory: () => new Wallet(config.COMPANY_MASTER_WALLET_MNEMONIC) });
container.register(COMMUNITY_MASTER_WALLET, { useFactory: () => new Wallet(config.COMMUNITY_MASTER_WALLET_MNEMONIC) });

export const InjectWallet = (walletType: MasterWalletType) => inject(`${walletType}_MASTER_WALLET`);

export const resolveWallet = (walletType: MasterWalletType) => container.resolve(`${walletType}_MASTER_WALLET`);

// Master wallet mnemonic mapping service
export class MasterWalletMnemonicService {
  private readonly addressToMnemonicMap: Map<string, string>;
  private readonly categoryToAddressesMap: Map<string, string[]>;

  constructor() {
    this.addressToMnemonicMap = new Map();
    this.categoryToAddressesMap = new Map();

    this.initializeWalletMappings();
  }

  private initializeWalletMappings(): void {
    // Validate that addresses and mnemonics arrays have the same length
    if (config.COMPANY_MASTER_WALLET_ADDRESSES.length !== config.COMPANY_MASTER_WALLET_MNEMONICS.length) {
      throw new Error("Company master wallet addresses and mnemonics arrays must have the same length");
    }

    if (config.COMMUNITY_MASTER_WALLET_ADDRESSES.length !== config.COMMUNITY_MASTER_WALLET_MNEMONICS.length) {
      throw new Error("Community master wallet addresses and mnemonics arrays must have the same length");
    }

    // Map company wallets
    for (let i = 0; i < config.COMPANY_MASTER_WALLET_ADDRESSES.length; i++) {
      const address = config.COMPANY_MASTER_WALLET_ADDRESSES[i];
      const mnemonic = config.COMPANY_MASTER_WALLET_MNEMONICS[i];
      this.addressToMnemonicMap.set(address, mnemonic);
    }
    this.categoryToAddressesMap.set("COMPANY", config.COMPANY_MASTER_WALLET_ADDRESSES);

    // Map community wallets
    for (let i = 0; i < config.COMMUNITY_MASTER_WALLET_ADDRESSES.length; i++) {
      const address = config.COMMUNITY_MASTER_WALLET_ADDRESSES[i];
      const mnemonic = config.COMMUNITY_MASTER_WALLET_MNEMONICS[i];
      this.addressToMnemonicMap.set(address, mnemonic);
    }
    this.categoryToAddressesMap.set("COMMUNITY", config.COMMUNITY_MASTER_WALLET_ADDRESSES);
  }

  getMnemonicByAddress(address: string): string | undefined {
    return this.addressToMnemonicMap.get(address);
  }

  getAddresses(): string[] {
    return Array.from(this.addressToMnemonicMap.keys());
  }

  getAddressesByCategory(category: string): string[] {
    return this.categoryToAddressesMap.get(category) || [];
  }

  hasAddress(address: string): boolean {
    return this.addressToMnemonicMap.has(address);
  }

  getWalletCount(): { company: number; community: number; total: number } {
    const companyCount = config.COMPANY_MASTER_WALLET_ADDRESSES.length;
    const communityCount = config.COMMUNITY_MASTER_WALLET_ADDRESSES.length;
    return {
      company: companyCount,
      community: communityCount,
      total: companyCount + communityCount
    };
  }
}

// Register the mnemonic service
container.register(MasterWalletMnemonicService, { useClass: MasterWalletMnemonicService });
