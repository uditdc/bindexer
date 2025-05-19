import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

// Create a client to interact with the Ethereum mainnet
const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

export default client
