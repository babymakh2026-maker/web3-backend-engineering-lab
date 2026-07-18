import fs from 'node:fs';
import path from 'node:path';

import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  type Address,
  type Hash,
  type Hex
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

import { messageRegistryAbi } from '../contracts/messageRegistryAbi.js';

const defaultRpcUrl = 'https://ethereum-sepolia-rpc.publicnode.com';
const deploymentPath = path.resolve('deployments', 'sepolia.json');

interface DeploymentFile {
  contractAddress?: string;
}

export interface TransactionReceiptSummary {
  status: 'success' | 'reverted';
  blockNumber: bigint;
  gasUsed: bigint;
}

export interface MessageRegistryAdapter {
  readMessage(address: Address): Promise<unknown>;
  readOwner(address: Address): Promise<unknown>;
  submitMessage(address: Address, message: string): Promise<Hash>;
  waitForReceipt(hash: Hash): Promise<TransactionReceiptSummary>;
}

export class ContractAddressUnavailableError extends Error {
  constructor() {
    super('MessageRegistry deployment address is not configured');
    this.name = 'ContractAddressUnavailableError';
  }
}

export class WriteSignerUnavailableError extends Error {
  constructor() {
    super('Sepolia write signer is not configured');
    this.name = 'WriteSignerUnavailableError';
  }
}

function readDeploymentAddress() {
  if (!fs.existsSync(deploymentPath)) return undefined;

  const deployment = JSON.parse(
    fs.readFileSync(deploymentPath, 'utf8')
  ) as DeploymentFile;
  return deployment.contractAddress;
}

function normalizePrivateKey(rawKey: string | undefined): Hex | undefined {
  if (rawKey === undefined) return undefined;

  const privateKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new TypeError('Portfolio signer must be a 32-byte hexadecimal key');
  }
  return privateKey as Hex;
}

function createViemAdapter(options: {
  rpcUrl?: string;
  privateKey?: string;
} = {}): MessageRegistryAdapter {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(options.rpcUrl ?? defaultRpcUrl, {
      retryCount: 1,
      timeout: 15_000
    })
  });
  const privateKey = normalizePrivateKey(options.privateKey);
  const account = privateKey ? privateKeyToAccount(privateKey) : undefined;
  const walletClient = account
    ? createWalletClient({
        account,
        chain: sepolia,
        transport: http(options.rpcUrl ?? defaultRpcUrl, {
          retryCount: 1,
          timeout: 15_000
        })
      })
    : undefined;

  return {
    readMessage(address) {
      return publicClient.readContract({
        address,
        abi: messageRegistryAbi,
        functionName: 'readMessage'
      });
    },
    readOwner(address) {
      return publicClient.readContract({
        address,
        abi: messageRegistryAbi,
        functionName: 'owner'
      });
    },
    async submitMessage(address, message) {
      if (!account || !walletClient) throw new WriteSignerUnavailableError();

      const { request } = await publicClient.simulateContract({
        account,
        address,
        abi: messageRegistryAbi,
        functionName: 'writeMessage',
        args: [message]
      });
      return walletClient.writeContract(request);
    },
    async waitForReceipt(hash) {
      const receipt = await publicClient.waitForTransactionReceipt({
        confirmations: 2,
        hash,
        timeout: 180_000
      });
      return {
        status: receipt.status,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed
      };
    }
  };
}

export interface MessageRegistryState {
  network: { name: string; chainId: number };
  contract: { name: string; address: Address };
  values: { message: string; owner: Address };
}

export function createMessageRegistryService(options: {
  address?: string;
  rpcUrl?: string;
  privateKey?: string;
  adapter?: MessageRegistryAdapter;
} = {}) {
  const rawAddress =
    options.address ?? process.env.MESSAGE_REGISTRY_ADDRESS ?? readDeploymentAddress();
  const address = rawAddress ? getAddress(rawAddress) : undefined;
  const adapter =
    options.adapter ??
    createViemAdapter({
      ...(options.rpcUrl === undefined ? {} : { rpcUrl: options.rpcUrl }),
      ...(options.privateKey === undefined
        ? {}
        : { privateKey: options.privateKey })
    });

  function requireAddress() {
    if (!address) throw new ContractAddressUnavailableError();
    return address;
  }

  async function readState(): Promise<MessageRegistryState> {
    const contractAddress = requireAddress();
    const [message, owner] = await Promise.all([
      adapter.readMessage(contractAddress),
      adapter.readOwner(contractAddress)
    ]);
    if (typeof message !== 'string') {
      throw new TypeError('Contract returned an invalid message');
    }
    if (typeof owner !== 'string') {
      throw new TypeError('Contract returned an invalid owner');
    }

    return {
      network: { name: sepolia.name, chainId: sepolia.id },
      contract: { name: 'MessageRegistry', address: contractAddress },
      values: { message, owner: getAddress(owner) }
    };
  }

  return {
    readState,
    async writeMessage(message: string) {
      const contractAddress = requireAddress();
      const hash = await adapter.submitMessage(contractAddress, message);
      const receipt = await adapter.waitForReceipt(hash);
      if (receipt.status !== 'success') {
        throw new Error(`Contract transaction ${hash} reverted`);
      }
      const state = await readState();
      if (state.values.message !== message) {
        throw new Error('Read-after-write did not return the submitted message');
      }

      return {
        hash,
        status: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        message,
        state
      };
    }
  };
}

export type MessageRegistryService = ReturnType<
  typeof createMessageRegistryService
>;
