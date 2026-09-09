export interface BlockchainConfigState {
  configured: boolean;
  message: string;
}

export function getTokenIntegrationState(env: Record<string, string | undefined>): BlockchainConfigState {
  if (!env.ZVX_MINT_ADDRESS) {
    return { configured: false, message: "Token integration not configured." };
  }

  if (!env.SOLANA_RPC_URL) {
    return { configured: false, message: "SOLANA_RPC_URL missing." };
  }

  if (!env.JUPITER_API_URL) {
    return { configured: false, message: "JUPITER_API_URL missing." };
  }

  return { configured: true, message: "Token integration configured." };
}

export class JupiterAdapter {
  constructor(private readonly baseUrl: string) {}

  async getQuote() {
    throw new Error(`Jupiter quote retrieval requires configured credentials and request parameters. Base URL: ${this.baseUrl}`);
  }

  async getRoutes() {
    throw new Error(`Jupiter route retrieval requires configured credentials and request parameters. Base URL: ${this.baseUrl}`);
  }

  async prepareSwap() {
    throw new Error("Swap preparation requires explicit user-confirmed transaction parameters.");
  }

  async validateTransaction() {
    throw new Error("Transaction validation adapter endpoint not configured.");
  }

  async executeSwap() {
    throw new Error("Swap execution is disabled until explicit user confirmation and policy checks pass.");
  }
}
