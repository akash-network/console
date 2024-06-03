export interface ValidatorSummaryDetail {
  rank: number;
  operatorAddress: string;
  keybaseAvatarUrl?: string;
  moniker: string;
  votingPower: number;
  votingPowerRatio: number;
  commission: number;
  identity: string;
}

export interface ValidatorDetail {
  rank: number;
  operatorAddress: string;
  address: string;
  keybaseAvatarUrl?: string;
  keybaseUsername?: string;
  moniker: string;
  votingPower: number;
  commission: number;
  maxCommission: number;
  maxCommissionChange: number;
  identity: string;
  description: string;
  website: string;
}

export interface IValidatorAddess {
  address: string;
  operatorAddress: string;
  moniker: string;
  avatarUrl: string;
}
