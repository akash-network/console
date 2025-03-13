import {
  MsgCloseDeployment,
  MsgCreateDeployment,
} from '@akashnetwork/akash-api/v1beta3';
import { faker } from '@faker-js/faker';

import {
  DecodedMessageValue,
  MessageTypeFilter,
} from '../../src/chain-events/services/block-message-parser/block-message-parser.service';

/**
 * Generates a DeploymentID object
 */
export function generateDeploymentID(
  options: {
    owner?: string;
    dseq?: string;
  } = {},
) {
  return {
    owner: options.owner || faker.finance.ethereumAddress(),
    dseq: options.dseq || faker.string.numeric(10),
  };
}

/**
 * Generates a transaction message
 */
export function generateTransactionMessage(
  type:
    | 'MsgCreateDeployment'
    | 'MsgCloseDeployment'
    | string = 'MsgCreateDeployment',
) {
  let typeUrl: string;

  switch (type) {
    case 'MsgCreateDeployment':
      typeUrl = '/akash.deployment.v1beta3.MsgCreateDeployment';
      break;
    case 'MsgCloseDeployment':
      typeUrl = '/akash.deployment.v1beta3.MsgCloseDeployment';
      break;
    default:
      typeUrl = `/${type}`;
  }

  return {
    typeUrl,
    value: new Uint8Array(faker.number.int({ min: 3, max: 10 })),
  };
}

/**
 * Generates a parsed transaction
 */
export function generateParsedTransaction(
  options: {
    hash?: string;
    height?: number;
    messageTypes?: Array<string>;
    memo?: string;
  } = {},
) {
  const messageTypes = options.messageTypes || ['MsgCreateDeployment'];

  return {
    hash: options.hash || faker.string.alphanumeric(64).toUpperCase(),
    height: options.height || faker.number.int({ min: 1, max: 1000000 }),
    messages: messageTypes.map((type) => generateTransactionMessage(type)),
    memo: options.memo || faker.lorem.sentence(),
  };
}

/**
 * Generates an array of parsed transactions
 */
export function generateParsedTransactions(
  options: {
    count?: number;
    messageTypes?: Array<string>;
  } = {},
) {
  const count = options.count || faker.number.int({ min: 1, max: 5 });

  return Array.from({ length: count }, () =>
    generateParsedTransaction({ messageTypes: options.messageTypes }),
  );
}

/**
 * Generates a CreateDeployment message
 */
export function generateMsgCreateDeploymentMessage(
  options: {
    deploymentId?: ReturnType<typeof generateDeploymentID>;
  } = {},
) {
  const deploymentId = options.deploymentId || generateDeploymentID();

  return {
    type: 'MsgCreateDeployment',
    typeUrl: '/akash.deployment.v1beta3.MsgCreateDeployment',
    value: {
      id: deploymentId,
      groups: Array.from(
        { length: faker.number.int({ min: 1, max: 3 }) },
        () => ({
          name: faker.string.alphanumeric(5),
          resources: Array.from(
            { length: faker.number.int({ min: 1, max: 3 }) },
            () => ({
              resources: {
                cpu: {
                  units: {
                    val: faker.string.numeric(3),
                  },
                },
                memory: {
                  quantity: {
                    val: faker.string.numeric(9),
                  },
                },
                storage: Array.from(
                  { length: faker.number.int({ min: 1, max: 2 }) },
                  () => ({
                    name: faker.string.alphanumeric(5),
                    quantity: {
                      val: faker.string.numeric(9),
                    },
                  }),
                ),
              },
              count: faker.number.int({ min: 1, max: 5 }),
              price: {
                denom: 'uakt',
                amount: faker.string.numeric(6),
              },
            }),
          ),
        }),
      ),
      deposit: {
        denom: 'uakt',
        amount: faker.string.numeric(6),
      },
      depositor: faker.finance.ethereumAddress(),
    },
  };
}

/**
 * Generates a CloseDeployment message
 */
export function generateMsgCloseDeploymentMessage(
  options: {
    deploymentId?: ReturnType<typeof generateDeploymentID>;
  } = {},
) {
  const deploymentId = options.deploymentId || generateDeploymentID();

  return {
    type: 'MsgCloseDeployment',
    typeUrl: '/akash.deployment.v1beta3.MsgCloseDeployment',
    value: {
      id: deploymentId,
    },
  };
}

/**
 * Generates related deployment messages (create and close) with the same deployment ID
 */
export function generateRelatedDeploymentMessages() {
  const deploymentId = generateDeploymentID();

  return {
    create: generateMsgCreateDeploymentMessage({ deploymentId }),
    close: generateMsgCloseDeploymentMessage({ deploymentId }),
  };
}

/**
 * Generates a mock BlockMessage object for testing
 */
export function generateMockBlockMessage(
  type:
    | 'MsgCreateDeployment'
    | 'MsgCloseDeployment'
    | string = 'MsgCreateDeployment',
) {
  let typeUrl: string;
  let value: DecodedMessageValue;

  switch (type) {
    case 'MsgCreateDeployment':
      typeUrl = MsgCreateDeployment['$type'];
      value = {
        id: {
          owner: faker.finance.ethereumAddress(),
          dseq: faker.string.numeric(10),
        },
        groups: Array.from(
          { length: faker.number.int({ min: 1, max: 3 }) },
          () => ({
            name: faker.string.alphanumeric(5),
            resources: Array.from(
              { length: faker.number.int({ min: 1, max: 3 }) },
              () => ({
                resources: {
                  cpu: {
                    units: {
                      val: faker.string.numeric(3),
                    },
                  },
                  memory: {
                    quantity: {
                      val: faker.string.numeric(9),
                    },
                  },
                  storage: Array.from(
                    { length: faker.number.int({ min: 1, max: 2 }) },
                    () => ({
                      name: faker.string.alphanumeric(5),
                      quantity: {
                        val: faker.string.numeric(9),
                      },
                    }),
                  ),
                },
                count: faker.number.int({ min: 1, max: 5 }),
                price: {
                  denom: 'uakt',
                  amount: faker.string.numeric(6),
                },
              }),
            ),
          }),
        ),
        deposit: {
          denom: 'uakt',
          amount: faker.string.numeric(6),
        },
        depositor: faker.finance.ethereumAddress(),
      };
      break;
    case 'MsgCloseDeployment':
      typeUrl = MsgCloseDeployment['$type'];
      value = {
        id: {
          owner: faker.finance.ethereumAddress(),
          dseq: faker.string.numeric(10),
        },
      };
      break;
    default:
      typeUrl = `/${type}`;
      value = {
        data: faker.string.alphanumeric(20),
      };
  }

  return {
    type: type,
    typeUrl,
    value,
  };
}

/**
 * Generates an array of mock messages for testing
 */
export function generateMockMessages(
  options: {
    count?: number;
    types?: Array<'MsgCreateDeployment' | 'MsgCloseDeployment' | string>;
  } = {},
) {
  const count = options.count || faker.number.int({ min: 1, max: 5 });
  const types = options.types || ['MsgCreateDeployment', 'MsgCloseDeployment'];

  return Array.from({ length: count }, () => {
    const type = faker.helpers.arrayElement(types);
    return generateMockBlockMessage(type);
  });
}

/**
 * Gets a random message type filter
 */
export function getRandomMessageTypeFilter(): MessageTypeFilter {
  return faker.helpers.arrayElement([
    '/akash.deployment.v1beta3.MsgCreateDeployment',
    '/akash.deployment.v1beta3.MsgCloseDeployment',
  ]) as MessageTypeFilter;
}

/**
 * Generates an array of message type filters
 */
export function generateMessageTypeFilters(
  count: number = 1,
): MessageTypeFilter[] {
  return Array.from({ length: count }, () => getRandomMessageTypeFilter());
}

/**
 * Generates a message in the format expected by the controller
 */
export function generateMsgCloseDeployment(
  options: {
    dseq?: string;
    owner?: string;
  } = {},
) {
  const deploymentId = generateDeploymentID({
    owner: options.owner,
    dseq: options.dseq || faker.string.numeric(6),
  });

  return {
    type: 'akash.deployment.v1beta3.MsgCloseDeployment',
    typeUrl: '/akash.deployment.v1beta3.MsgCloseDeployment',
    value: {
      id: {
        dseq: { low: parseInt(deploymentId.dseq, 10) },
        owner: deploymentId.owner,
      },
      $type: 'akash.deployment.v1beta3.MsgCloseDeployment',
    },
  };
}

/**
 * Generates a message in the format expected by the controller
 */
export function generateMsgCreateDeployment(
  options: {
    dseq?: string;
    owner?: string;
  } = {},
) {
  const deploymentId = generateDeploymentID({
    owner: options.owner,
    dseq: options.dseq || faker.string.numeric(6),
  });

  const baseMessage = generateMsgCreateDeploymentMessage({ deploymentId });

  return {
    type: 'akash.deployment.v1beta3.MsgCreateDeployment',
    typeUrl: '/akash.deployment.v1beta3.MsgCreateDeployment',
    value: {
      ...baseMessage.value,
      id: {
        dseq: { low: parseInt(deploymentId.dseq, 10) },
        owner: deploymentId.owner,
      },
      $type: 'akash.deployment.v1beta3.MsgCreateDeployment',
    },
  };
}
