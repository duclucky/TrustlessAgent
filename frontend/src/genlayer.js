import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionStatus } from 'genlayer-js/types';

export const AGENT_ESCROW =
  import.meta.env.VITE_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

const readAccount = createAccount();

export const readClient = createClient({
  chain: studionet,
  account: readAccount,
});

export async function readEscrow(functionName, args = []) {
  return await readClient.readContract({
    address: AGENT_ESCROW,
    functionName,
    args,
  });
}

export function makeWriteClient(walletAddress) {
  return createClient({
    chain: studionet,
    account: walletAddress,
  });
}

export { TransactionStatus };
