import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPublicClient, getAddress, http } from 'viem';
import { sepolia } from 'viem/chains';

import {
  artifactPath,
  type ContractArtifact
} from './compile-contract.js';
import { messageRegistryAbi } from '../src/contracts/messageRegistryAbi.js';

interface Deployment {
  chainId: number;
  contractAddress: string;
  ownerAddress: string;
  deploymentTransactionHash: `0x${string}`;
  deploymentBlock: string;
}

export function maskImmutableReferences(
  bytecode: `0x${string}`,
  references: ContractArtifact['immutableReferences']
) {
  const bytes = Buffer.from(bytecode.slice(2), 'hex');
  for (const locations of Object.values(references)) {
    for (const { start, length } of locations) {
      bytes.fill(0, start, start + length);
    }
  }
  return `0x${bytes.toString('hex')}` as const;
}

export async function verifyDeployment() {
  const deployment = JSON.parse(
    fs.readFileSync(path.resolve('deployments', 'sepolia.json'), 'utf8')
  ) as Deployment;
  const artifact = JSON.parse(
    fs.readFileSync(artifactPath, 'utf8')
  ) as ContractArtifact;
  const address = getAddress(deployment.contractAddress);
  const client = createPublicClient({
    chain: sepolia,
    transport: http(
      process.env.SEPOLIA_RPC_URL ??
        'https://ethereum-sepolia-rpc.publicnode.com',
      { retryCount: 1, timeout: 15_000 }
    )
  });

  const [chainId, bytecode, receipt, owner, message] = await Promise.all([
    client.getChainId(),
    client.getCode({ address }),
    client.getTransactionReceipt({
      hash: deployment.deploymentTransactionHash
    }),
    client.readContract({
      address,
      abi: messageRegistryAbi,
      functionName: 'owner'
    }),
    client.readContract({
      address,
      abi: messageRegistryAbi,
      functionName: 'readMessage'
    })
  ]);
  if (!bytecode) throw new Error('No runtime bytecode exists at deployment');

  const checks = {
    chainId: chainId === deployment.chainId,
    bytecode:
      maskImmutableReferences(bytecode, artifact.immutableReferences) ===
      maskImmutableReferences(
        artifact.deployedBytecode,
        artifact.immutableReferences
      ),
    deploymentReceipt:
      receipt.status === 'success' &&
      receipt.blockNumber.toString() === deployment.deploymentBlock,
    owner: getAddress(owner) === getAddress(deployment.ownerAddress)
  };
  if (Object.values(checks).some((value) => !value)) {
    throw new Error(`Deployment checks failed: ${JSON.stringify(checks)}`);
  }

  const report = {
    network: { name: sepolia.name, chainId },
    contract: { address, runtimeBytecodeBytes: (bytecode.length - 2) / 2 },
    owner,
    message,
    checks,
    verification: 'passed'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await verifyDeployment();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Verification failed: ${message}\n`);
    process.exitCode = 1;
  }
}
