import type { BindexerConfig } from '../types/config'

export interface ProjectTemplate {
  name: string
  description: string
  config: BindexerConfig
  instructions?: string[]
}

export const TEMPLATES: Record<string, ProjectTemplate> = {
  erc20: {
    name: 'ERC-20 Token',
    description: 'Monitor ERC-20 token transfers and approvals',
    config: {
      version: '1.0',
      project: 'erc20-indexer',
      environment: 'development',
      network: 'mainnet',
      contracts: [
        {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
          name: 'USDC',
          events: ['Transfer', 'Approval'],
        },
      ],
      events: [
        {
          signature: 'Transfer(address indexed from, address indexed to, uint256 value)',
          name: 'Transfer',
        },
        {
          signature: 'Approval(address indexed owner, address indexed spender, uint256 value)',
          name: 'Approval',
        },
      ],
      startBlock: 18000000,
      api: {
        enabled: true,
        port: 3000,
        cors: true,
      },
      database: {
        path: 'erc20-logs.sqlite',
        walMode: true,
      },
      monitoring: {
        progressTracking: true,
        logLevel: 'info',
      },
      retry: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        strategy: 'exponential',
      },
    },
    instructions: [
      'Replace the contract address with your target ERC-20 token',
      'Adjust the startBlock to your desired starting point',
      'Set your RPC URL: export RPC_URL="your-rpc-endpoint"',
      'Run: bun run src/index.ts',
    ],
  },

  'uniswap-v3': {
    name: 'Uniswap V3',
    description: 'Monitor Uniswap V3 pool events and swaps',
    config: {
      version: '1.0',
      project: 'uniswap-v3-indexer',
      environment: 'development',
      network: 'mainnet',
      contracts: [
        {
          address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640', // USDC/WETH 0.05% pool
          name: 'USDC-WETH-0.05%',
          events: ['Swap', 'Mint', 'Burn', 'Collect'],
        },
      ],
      events: [
        {
          signature:
            'Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
          name: 'Swap',
        },
        {
          signature:
            'Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
          name: 'Mint',
        },
        {
          signature:
            'Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
          name: 'Burn',
        },
        {
          signature:
            'Collect(address indexed owner, address recipient, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount0, uint128 amount1)',
          name: 'Collect',
        },
      ],
      startBlock: 18000000,
      api: {
        enabled: true,
        port: 3000,
        cors: true,
      },
      database: {
        path: 'uniswap-v3-logs.sqlite',
        walMode: true,
      },
      monitoring: {
        progressTracking: true,
        logLevel: 'info',
      },
      batchSize: 2000, // Smaller batches for high-activity pools
    },
    instructions: [
      'Replace the pool address with your target Uniswap V3 pool',
      'Consider using smaller batch sizes for high-activity pools',
      'Monitor gas costs for historical sync on mainnet',
      'Use environment-specific RPC endpoints for better performance',
    ],
  },

  defi: {
    name: 'DeFi Protocol',
    description: 'Monitor DeFi protocol events (lending, borrowing, liquidations)',
    config: {
      version: '1.0',
      project: 'defi-indexer',
      environment: 'development',
      network: 'mainnet',
      contracts: [
        {
          address: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9', // Aave LendingPool
          name: 'Aave-LendingPool',
          events: ['Deposit', 'Withdraw', 'Borrow', 'Repay', 'LiquidationCall'],
        },
      ],
      events: [
        {
          signature:
            'Deposit(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referral)',
          name: 'Deposit',
        },
        {
          signature:
            'Withdraw(address indexed reserve, address indexed user, address indexed to, uint256 amount)',
          name: 'Withdraw',
        },
        {
          signature:
            'Borrow(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint256 borrowRateMode, uint256 borrowRate, uint16 indexed referral)',
          name: 'Borrow',
        },
        {
          signature:
            'Repay(address indexed reserve, address indexed user, address indexed repayer, uint256 amount)',
          name: 'Repay',
        },
        {
          signature:
            'LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user, uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)',
          name: 'LiquidationCall',
        },
      ],
      startBlock: 18000000,
      api: {
        enabled: true,
        port: 3000,
        cors: true,
      },
      database: {
        path: 'defi-logs.sqlite',
        walMode: true,
      },
      monitoring: {
        progressTracking: true,
        logLevel: 'info',
      },
      profiles: {
        production: {
          monitoring: {
            progressTracking: true,
            logLevel: 'warn',
            structuredLogging: true,
          },
          retry: {
            maxRetries: 5,
            baseDelay: 2000,
            maxDelay: 60000,
            strategy: 'exponential',
          },
        },
      },
    },
    instructions: [
      'Replace with your target DeFi protocol contracts',
      'Monitor multiple related contracts for complete coverage',
      'Consider adding price oracle events for enhanced analytics',
      'Use production profile for deployed environments',
    ],
  },

  'multi-chain': {
    name: 'Multi-Chain',
    description: 'Template for monitoring events across multiple networks',
    config: {
      version: '1.0',
      project: 'multi-chain-indexer',
      environment: 'development',
      network: 'mainnet',
      contracts: [
        {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          name: 'USDC-Mainnet',
          network: 'mainnet',
        },
      ],
      events: [
        {
          signature: 'Transfer(address indexed from, address indexed to, uint256 value)',
          name: 'Transfer',
        },
      ],
      startBlock: 18000000,
      api: {
        enabled: true,
        port: 3000,
        cors: true,
      },
      database: {
        path: 'multi-chain-logs.sqlite',
        walMode: true,
      },
      profiles: {
        polygon: {
          network: 'polygon',
          contracts: [
            {
              address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
              name: 'USDC-Polygon',
              network: 'polygon',
            },
          ],
          startBlock: 40000000,
        },
        arbitrum: {
          network: 'arbitrum',
          contracts: [
            {
              address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
              name: 'USDC-Arbitrum',
              network: 'arbitrum',
            },
          ],
          startBlock: 100000000,
        },
      },
    },
    instructions: [
      'Use different profiles for different networks: --profile=polygon',
      'Set network-specific RPC URLs via environment variables',
      'Consider separate database files for each network',
      'Monitor cross-chain bridge events for complete picture',
    ],
  },

  minimal: {
    name: 'Minimal',
    description: 'Minimal configuration template for custom setups',
    config: {
      version: '1.0',
      project: 'custom-indexer',
      network: 'sepolia',
      contracts: ['0x...'],
      events: ['EventName(...)'],
      api: {
        enabled: false,
        port: 3000,
      },
      monitoring: {
        progressTracking: true,
        logLevel: 'info',
      },
    },
    instructions: [
      'Replace contract addresses and event signatures',
      'Choose your target network',
      'Enable API server if needed',
      'Customize monitoring and retry settings',
    ],
  },
}

export function getTemplate(name: string): ProjectTemplate | null {
  return TEMPLATES[name] || null
}

export function listTemplates(): ProjectTemplate[] {
  return Object.values(TEMPLATES)
}

export function getTemplateNames(): string[] {
  return Object.keys(TEMPLATES)
}
