import { createPublicClient, http } from 'viem'
import { mainnet, sepolia, holesky } from 'viem/chains'

// Network configuration mapping
const NETWORKS = {
  mainnet: {
    chain: mainnet,
    defaultRpc: 'https://eth.llamarpc.com',
  },
  sepolia: {
    chain: sepolia,
    defaultRpc: 'https://ethereum-sepolia-rpc.publicnode.com',
  },
  holesky: {
    chain: holesky,
    defaultRpc: 'https://ethereum-holesky-rpc.publicnode.com',
  },
}

// Get network from environment or default to sepolia
const NETWORK = (process.env.NETWORK || 'sepolia') as keyof typeof NETWORKS
const networkConfig = NETWORKS[NETWORK] || NETWORKS.sepolia

// Get RPC URL from environment or use default
const RPC_URL = process.env.RPC_URL || networkConfig.defaultRpc

// Create a client with enhanced configuration
const client = createPublicClient({
  chain: networkConfig.chain,
  transport: http(RPC_URL, {
    // Add retry logic
    retryCount: 3,
    retryDelay: 1000, // 1 second base delay
    // Request timeout
    timeout: 30000, // 30 seconds
  }),
})

// Export both the client and network info for debugging
export default client
export { NETWORK, RPC_URL, networkConfig }
