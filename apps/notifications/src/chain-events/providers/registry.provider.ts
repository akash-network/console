import * as v1beta1 from '@akashnetwork/akash-api/v1beta1';
import * as v1beta2 from '@akashnetwork/akash-api/v1beta2';
import * as v1beta3 from '@akashnetwork/akash-api/v1beta3';
import * as v1beta4 from '@akashnetwork/akash-api/v1beta4';
import { GeneratedType, Registry } from '@cosmjs/proto-signing';
import { defaultRegistryTypes } from '@cosmjs/stargate';
import { Provider } from '@nestjs/common';
import { MsgUnjail } from 'cosmjs-types/cosmos/slashing/v1beta1/tx';

export const RegistryProvider: Provider<Registry> = {
  provide: Registry,
  useFactory: () => {
    const akashTypes: ReadonlyArray<[string, GeneratedType]> = [
      ...Object.values(v1beta1),
      ...Object.values(v1beta2),
      ...Object.values(v1beta3),
      ...Object.values(v1beta4),
    ].map((x) => ['/' + x.$type, x]);

    const missingTypes: ReadonlyArray<[string, GeneratedType]> = [
      ['/cosmos.slashing.v1beta1.MsgUnjail', MsgUnjail],
    ];

    return new Registry([
      ...defaultRegistryTypes,
      ...akashTypes,
      ...missingTypes,
    ]);
  },
};
