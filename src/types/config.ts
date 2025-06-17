/**
 * Comprehensive configuration schema for Bindexer
 * Supports multiple networks, contracts, and deployment environments
 */

export interface NetworkConfig {
  /** Network name (mainnet, sepolia, polygon, etc.) */
  name: string
  /** Chain ID for the network */
  chainId: number
  /** RPC URL for the network */
  rpcUrl?: string
  /** Default RPC URL if none provided */
  defaultRpcUrl?: string
  /** Block explorer URL template */
  explorerUrl?: string
  /** Default start block for this network */
  defaultStartBlock?: number
  /** Maximum blocks per batch for this network */
  maxBatchSize?: number
}

export interface ContractConfig {
  /** Contract address */
  address: string
  /** Optional contract name for identification */
  name?: string
  /** Events to monitor for this specific contract */
  events?: string[]
  /** Starting block for this contract (overrides global startBlock) */
  startBlock?: number
  /** Network this contract is deployed on */
  network?: string
  /** Contract ABI (optional, for better event parsing) */
  abi?: any[]
}

export interface EventConfig {
  /** Event signature (e.g., "Transfer(address,address,uint256)") */
  signature: string
  /** Optional event name for identification */
  name?: string
  /** Specific contracts this event applies to */
  contracts?: string[]
  /** Custom handling for this event */
  handler?: string
}

export interface ApiConfig {
  /** Enable API server */
  enabled: boolean
  /** Port for API server */
  port: number
  /** API host (default: localhost) */
  host?: string
  /** Enable CORS */
  cors?: boolean
  /** API rate limiting */
  rateLimit?: {
    windowMs: number
    max: number
  }
  /** Authentication settings */
  auth?: {
    enabled: boolean
    apiKey?: string
  }
}

export interface DatabaseConfig {
  /** Database file path */
  path: string
  /** Enable WAL mode for better performance */
  walMode?: boolean
  /** Database connection pool size */
  poolSize?: number
  /** Enable query logging */
  queryLogging?: boolean
}

export interface MonitoringConfig {
  /** Enable progress tracking */
  progressTracking: boolean
  /** Enable performance metrics */
  performanceMetrics?: boolean
  /** Log level (debug, info, warn, error) */
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
  /** Enable structured logging */
  structuredLogging?: boolean
}

export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number
  /** Base delay between retries (ms) */
  baseDelay: number
  /** Maximum delay between retries (ms) */
  maxDelay: number
  /** Retry strategy (exponential, linear, fixed) */
  strategy: 'exponential' | 'linear' | 'fixed'
}

export interface BindexerConfig {
  /** Configuration schema version */
  version?: string

  /** Project name/identifier */
  project?: string

  /** Environment (development, staging, production) */
  environment?: string

  /** Network configuration */
  network: string | NetworkConfig

  /** Contracts to monitor */
  contracts: (string | ContractConfig)[]

  /** Events to monitor */
  events: (string | EventConfig)[]

  /** Starting block for historical processing */
  startBlock?: number

  /** API server configuration */
  api?: boolean | ApiConfig

  /** Database configuration */
  database?: string | DatabaseConfig

  /** Monitoring and logging configuration */
  monitoring?: MonitoringConfig

  /** Retry configuration */
  retry?: RetryConfig

  /** Custom batch size for block processing */
  batchSize?: number

  /** Additional environment-specific overrides */
  profiles?: Record<string, Partial<BindexerConfig>>

  /** Include other config files */
  includes?: string[]

  /** Template this config is based on */
  template?: string

  /** Custom metadata for the project */
  metadata?: Record<string, any>
}

export interface CLIConfig extends BindexerConfig {
  /** Config file path used */
  configPath?: string

  /** Profile name being used */
  profile?: string

  /** Whether to generate config file */
  generateConfig?: boolean

  /** Template to use for initialization */
  initTemplate?: string
}

export interface EnvironmentMapping {
  /** Environment variable name to config path mapping */
  [key: string]: string
}

export const DEFAULT_ENV_MAPPING: EnvironmentMapping = {
  BINDEXER_NETWORK: 'network',
  BINDEXER_RPC_URL: 'network.rpcUrl',
  BINDEXER_START_BLOCK: 'startBlock',
  BINDEXER_API_PORT: 'api.port',
  BINDEXER_API_ENABLED: 'api.enabled',
  BINDEXER_DATABASE_PATH: 'database.path',
  BINDEXER_LOG_LEVEL: 'monitoring.logLevel',
  BINDEXER_MAX_RETRIES: 'retry.maxRetries',
  BINDEXER_BATCH_SIZE: 'batchSize',
  BINDEXER_PROJECT: 'project',
  BINDEXER_ENVIRONMENT: 'environment',
}

export const DEFAULT_NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    name: 'mainnet',
    chainId: 1,
    defaultRpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    defaultStartBlock: 18000000,
    maxBatchSize: 4999,
  },
  sepolia: {
    name: 'sepolia',
    chainId: 11155111,
    defaultRpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    defaultStartBlock: 4000000,
    maxBatchSize: 4999,
  },
  holesky: {
    name: 'holesky',
    chainId: 17000,
    defaultRpcUrl: 'https://ethereum-holesky-rpc.publicnode.com',
    explorerUrl: 'https://holesky.etherscan.io',
    defaultStartBlock: 1000000,
    maxBatchSize: 4999,
  },
  polygon: {
    name: 'polygon',
    chainId: 137,
    defaultRpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    defaultStartBlock: 40000000,
    maxBatchSize: 3500,
  },
  arbitrum: {
    name: 'arbitrum',
    chainId: 42161,
    defaultRpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    defaultStartBlock: 100000000,
    maxBatchSize: 4999,
  },
}

export const DEFAULT_CONFIG: Partial<BindexerConfig> = {
  version: '1.0',
  environment: 'development',
  api: {
    enabled: false,
    port: 3000,
    host: 'localhost',
    cors: true,
  },
  database: {
    path: 'logs.sqlite',
    walMode: true,
    queryLogging: false,
  },
  monitoring: {
    progressTracking: true,
    performanceMetrics: true,
    logLevel: 'info',
    structuredLogging: false,
  },
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    strategy: 'exponential',
  },
  batchSize: 4999,
}
