import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

export const WETH9 = {
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as const,
  blockNumber: 20_000_000n,
  label: 'Wrapped Ether (WETH9)'
};

export const wethReadAbi = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

type FunctionName = 'name' | 'symbol' | 'decimals' | 'totalSupply';
type ReadFunction = (functionName: FunctionName) => Promise<unknown>;

export interface WethSnapshot {
  network: { name: string; chainId: number };
  contract: { name: string; address: `0x${string}`; blockNumber: string };
  values: {
    name: string;
    symbol: string;
    decimals: number;
    totalSupplyWei: string;
  };
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`Contract returned an invalid ${field}`);
  }
}

function assertBigInt(value: unknown, field: string): asserts value is bigint {
  if (typeof value !== 'bigint') {
    throw new TypeError(`Contract returned an invalid ${field}`);
  }
}

function assertUint8(value: unknown, field: string): asserts value is number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 255) {
    throw new TypeError(`Contract returned an invalid ${field}`);
  }
}

export function createWethSnapshotService(options: {
  rpcUrl?: string;
  readFunction?: ReadFunction;
} = {}) {
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(options.rpcUrl ?? 'https://eth.drpc.org', {
      retryCount: 1,
      timeout: 10_000
    })
  });

  const readFunction: ReadFunction =
    options.readFunction ??
    ((functionName) =>
      publicClient.readContract({
        address: WETH9.address,
        abi: wethReadAbi,
        functionName,
        blockNumber: WETH9.blockNumber
      }));

  return {
    async getSnapshot(): Promise<WethSnapshot> {
      // Sequential historical reads stay within conservative public RPC limits.
      const name = await readFunction('name');
      const symbol = await readFunction('symbol');
      const decimals = await readFunction('decimals');
      const totalSupply = await readFunction('totalSupply');

      assertString(name, 'name');
      assertString(symbol, 'symbol');
      assertUint8(decimals, 'decimals');
      assertBigInt(totalSupply, 'totalSupply');

      return {
        network: { name: mainnet.name, chainId: mainnet.id },
        contract: {
          name: WETH9.label,
          address: WETH9.address,
          blockNumber: WETH9.blockNumber.toString()
        },
        values: {
          name,
          symbol,
          decimals,
          totalSupplyWei: totalSupply.toString()
        }
      };
    }
  };
}

export type WethSnapshotService = ReturnType<typeof createWethSnapshotService>;
