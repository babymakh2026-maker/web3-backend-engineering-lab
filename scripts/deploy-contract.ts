import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

import {
  compileMessageRegistry,
  writeContractArtifact
} from './compile-contract.js';

const deploymentPath = path.resolve('deployments', 'sepolia.json');
const defaultRpcUrl = 'https://ethereum-sepolia-rpc.publicnode.com';

function getPrivateKey(): Hex {
  const rawKey = process.env.PORTFOLIO_SIGNER_PRIVATE_KEY;
  if (!rawKey) throw new Error('PORTFOLIO_SIGNER_PRIVATE_KEY is required');

  const privateKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('Portfolio signer must be a 32-byte hexadecimal key');
  }
  return privateKey as Hex;
}

export async function deployMessageRegistry() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL ?? defaultRpcUrl;
  const initialMessage =
    process.env.MESSAGE_REGISTRY_INITIAL_MESSAGE ??
    'Web3 backend portfolio deployment';
  const account = privateKeyToAccount(getPrivateKey());
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl, { retryCount: 1, timeout: 15_000 })
  });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl, { retryCount: 1, timeout: 15_000 })
  });
  const artifact = compileMessageRegistry();
  writeContractArtifact(artifact);

  const transactionHash = await walletClient.deployContract({
    abi: artifact.abi,
    account,
    args: [initialMessage],
    bytecode: artifact.bytecode
  });
  const receipt = await publicClient.waitForTransactionReceipt({
    confirmations: 2,
    hash: transactionHash,
    timeout: 180_000
  });
  if (receipt.status !== 'success' || !receipt.contractAddress) {
    throw new Error(`Deployment transaction ${transactionHash} failed`);
  }

  const block = await publicClient.getBlock({
    blockNumber: receipt.blockNumber
  });
  const deployment = {
    network: sepolia.name,
    chainId: sepolia.id,
    contractName: artifact.contractName,
    contractAddress: receipt.contractAddress,
    ownerAddress: account.address,
    deploymentTransactionHash: transactionHash,
    deploymentBlock: receipt.blockNumber.toString(),
    deployedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
    initialMessage,
    compiler: artifact.compiler,
    explorer: {
      contract: `https://sepolia.etherscan.io/address/${receipt.contractAddress}`,
      transaction: `https://sepolia.etherscan.io/tx/${transactionHash}`
    }
  };

  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, `${JSON.stringify(deployment, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(deployment, null, 2)}\n`);
  return deployment;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await deployMessageRegistry();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Deployment failed: ${message}\n`);
    process.exitCode = 1;
  }
}
