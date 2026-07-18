export const messageRegistryAbi = [
  {
    inputs: [{ internalType: 'string', name: 'initialMessage', type: 'string' }],
    stateMutability: 'nonpayable',
    type: 'constructor'
  },
  { inputs: [], name: 'EmptyMessage', type: 'error' },
  { inputs: [], name: 'NotOwner', type: 'error' },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'sender',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'previousMessage',
        type: 'string'
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'newMessage',
        type: 'string'
      }
    ],
    name: 'MessageUpdated',
    type: 'event'
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'readMessage',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'string', name: 'newMessage', type: 'string' }],
    name: 'writeMessage',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;
