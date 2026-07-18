import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import solc from 'solc';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(currentDirectory, '..');
const sourceName = 'contracts/MessageRegistry.sol';
const contractName = 'MessageRegistry';
const sourcePath = path.join(root, sourceName);
export const artifactPath = path.join(
  root,
  'generated',
  `${contractName}.json`
);

interface CompilerDiagnostic {
  severity: string;
  formattedMessage: string;
}

interface CompilerContract {
  abi: readonly unknown[];
  evm: {
    bytecode: { object: string };
    deployedBytecode: {
      object: string;
      immutableReferences: Record<
        string,
        Array<{ start: number; length: number }>
      >;
    };
  };
}

interface CompilerOutput {
  errors?: CompilerDiagnostic[];
  contracts: Record<string, Record<string, CompilerContract>>;
}

export interface ContractArtifact {
  contractName: string;
  sourceName: string;
  compiler: {
    version: string;
    optimizer: { enabled: boolean; runs: number };
    metadataBytecodeHash: string;
  };
  abi: readonly unknown[];
  bytecode: `0x${string}`;
  deployedBytecode: `0x${string}`;
  immutableReferences: Record<
    string,
    Array<{ start: number; length: number }>
  >;
}

export function compileMessageRegistry(): ContractArtifact {
  const input = {
    language: 'Solidity',
    sources: {
      [sourceName]: { content: fs.readFileSync(sourcePath, 'utf8') }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      metadata: { bytecodeHash: 'none' },
      outputSelection: {
        '*': {
          '*': [
            'abi',
            'evm.bytecode.object',
            'evm.deployedBytecode.object',
            'evm.deployedBytecode.immutableReferences'
          ]
        }
      }
    }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input))) as CompilerOutput;
  const errors = (output.errors ?? []).filter(
    ({ severity }) => severity === 'error'
  );
  if (errors.length > 0) {
    throw new Error(errors.map(({ formattedMessage }) => formattedMessage).join('\n'));
  }

  const compiled = output.contracts[sourceName]?.[contractName];
  if (!compiled) throw new Error('Compiler did not produce MessageRegistry');

  return {
    contractName,
    sourceName,
    compiler: {
      version: solc.version(),
      optimizer: { enabled: true, runs: 200 },
      metadataBytecodeHash: 'none'
    },
    abi: compiled.abi,
    bytecode: `0x${compiled.evm.bytecode.object}`,
    deployedBytecode: `0x${compiled.evm.deployedBytecode.object}`,
    immutableReferences: compiled.evm.deployedBytecode.immutableReferences
  };
}

export function writeContractArtifact(artifact: ContractArtifact) {
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const artifact = compileMessageRegistry();
    writeContractArtifact(artifact);
    process.stdout.write(
      `Compiled ${artifact.contractName} with ${artifact.compiler.version}\n`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Contract compilation failed: ${message}\n`);
    process.exitCode = 1;
  }
}
