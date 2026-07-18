import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compileMessageRegistry } from '../scripts/compile-contract.js';
import { messageRegistryAbi } from '../src/contracts/messageRegistryAbi.js';

test('compiles MessageRegistry reproducibly with the public ABI', () => {
  const artifact = compileMessageRegistry();
  const functions = artifact.abi
    .filter(
      (entry): entry is { name: string; stateMutability: string; type: string } =>
        typeof entry === 'object' &&
        entry !== null &&
        'type' in entry &&
        entry.type === 'function' &&
        'name' in entry &&
        typeof entry.name === 'string' &&
        'stateMutability' in entry &&
        typeof entry.stateMutability === 'string'
    )
    .map(({ name, stateMutability }) => ({ name, stateMutability }));

  assert.equal(artifact.contractName, 'MessageRegistry');
  assert.match(artifact.compiler.version, /^0\.8\.30\+/);
  assert.deepEqual(artifact.abi, messageRegistryAbi);
  assert.deepEqual(functions, [
    { name: 'owner', stateMutability: 'view' },
    { name: 'readMessage', stateMutability: 'view' },
    { name: 'writeMessage', stateMutability: 'nonpayable' }
  ]);
  assert.match(artifact.bytecode, /^0x[0-9a-f]+$/i);
  assert.ok(Object.keys(artifact.immutableReferences).length > 0);
});
