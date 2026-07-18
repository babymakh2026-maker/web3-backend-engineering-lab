import { z } from 'zod';

const privateKeyPattern = /^(?:0x)?[0-9a-fA-F]{64}$/;

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5025),
  ETHEREUM_RPC_URL: z.url().default('https://eth.drpc.org'),
  SEPOLIA_RPC_URL: z
    .url()
    .default('https://ethereum-sepolia-rpc.publicnode.com'),
  MESSAGE_REGISTRY_ADDRESS: z.string().optional(),
  PORTFOLIO_SIGNER_PRIVATE_KEY: z
    .string()
    .regex(privateKeyPattern)
    .optional(),
  PORTFOLIO_WRITE_TOKEN: z.string().min(32).optional()
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env
): Environment {
  return environmentSchema.parse(source);
}
