import * as path from 'path'
import * as fs from 'fs'
import type {
  BindexerConfig,
  CLIConfig,
  NetworkConfig,
  ContractConfig,
  EventConfig,
} from '../types/config'
import { DEFAULT_CONFIG, DEFAULT_NETWORKS, DEFAULT_ENV_MAPPING } from '../types/config'

export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public suggestions?: string[]
  ) {
    super(message)
    this.name = 'ConfigValidationError'
  }
}

export class ConfigManager {
  private static readonly CONFIG_FILE_NAMES = [
    'bindexer.config.json',
    'bindexer.config.js',
    '.bindexerrc',
    '.bindexerrc.json',
    'bindexer.json',
  ]

  private static readonly PACKAGE_JSON_FIELD = 'bindexer'

  /**
   * Discover config files in standard locations
   */
  static async discoverConfigFile(startDir: string = process.cwd()): Promise<string | null> {
    let currentDir = path.resolve(startDir)
    const rootDir = path.parse(currentDir).root

    // Search up the directory tree
    while (currentDir !== rootDir) {
      // Check for standard config files
      for (const fileName of this.CONFIG_FILE_NAMES) {
        const configPath = path.join(currentDir, fileName)
        if (await this.fileExists(configPath)) {
          return configPath
        }
      }

      // Check package.json for bindexer config
      const packageJsonPath = path.join(currentDir, 'package.json')
      if (await this.fileExists(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'))
          if (packageJson[this.PACKAGE_JSON_FIELD]) {
            return packageJsonPath
          }
        } catch {
          // Ignore invalid package.json files
        }
      }

      currentDir = path.dirname(currentDir)
    }

    return null
  }

  /**
   * Load and parse configuration from various sources
   */
  static async loadConfig(configPath?: string): Promise<BindexerConfig> {
    let config: Partial<BindexerConfig> = {}

    // Start with default config
    config = { ...DEFAULT_CONFIG }

    // Discover config file if not provided
    if (!configPath) {
      const discoveredPath = await this.discoverConfigFile()
      configPath = discoveredPath || undefined
    }

    // Load from config file
    if (configPath) {
      const fileConfig = await this.loadConfigFile(configPath)
      config = this.mergeConfigs(config, fileConfig)
    }

    // Load from environment variables
    const envConfig = this.loadFromEnvironment()
    config = this.mergeConfigs(config, envConfig)

    // Validate and normalize
    const validatedConfig = this.validateConfig(config as BindexerConfig)
    return this.normalizeConfig(validatedConfig)
  }

  /**
   * Load configuration from a specific file
   */
  static async loadConfigFile(configPath: string): Promise<Partial<BindexerConfig>> {
    if (!(await this.fileExists(configPath))) {
      throw new ConfigValidationError(`Config file not found: ${configPath}`)
    }

    try {
      const content = await fs.promises.readFile(configPath, 'utf-8')

      if (configPath.endsWith('package.json')) {
        const packageJson = JSON.parse(content)
        return packageJson[this.PACKAGE_JSON_FIELD] || {}
      }

      if (configPath.endsWith('.js')) {
        // For JS files, we'd need to use dynamic import, but for now support JSON only
        throw new ConfigValidationError(
          'JavaScript config files not yet supported. Use JSON format.'
        )
      }

      return JSON.parse(content)
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw error
      }
      throw new ConfigValidationError(
        `Failed to parse config file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'configFile'
      )
    }
  }

  /**
   * Load configuration from environment variables
   */
  static loadFromEnvironment(): Partial<BindexerConfig> {
    const config: any = {}

    for (const [envVar, configPath] of Object.entries(DEFAULT_ENV_MAPPING)) {
      const value = process.env[envVar]
      if (value !== undefined) {
        this.setNestedProperty(config, configPath, this.parseEnvValue(value))
      }
    }

    return config
  }

  /**
   * Validate configuration object
   */
  static validateConfig(config: BindexerConfig): BindexerConfig {
    const errors: ConfigValidationError[] = []

    // Validate required fields
    if (!config.contracts || config.contracts.length === 0) {
      errors.push(
        new ConfigValidationError('At least one contract must be specified', 'contracts', [
          'Add contracts via CLI: -c <address>',
          'Add contracts in config file',
        ])
      )
    }

    if (!config.events || config.events.length === 0) {
      errors.push(
        new ConfigValidationError('At least one event must be specified', 'events', [
          'Add events via CLI: -e "Transfer(address,address,uint256)"',
          'Add events in config file',
        ])
      )
    }

    if (!config.network) {
      errors.push(
        new ConfigValidationError('Network must be specified', 'network', [
          'Add network via CLI: -n mainnet',
          'Set BINDEXER_NETWORK environment variable',
        ])
      )
    }

    // Validate contracts
    config.contracts?.forEach((contract, index) => {
      try {
        this.validateContract(contract, index)
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          errors.push(error)
        }
      }
    })

    // Validate events
    config.events?.forEach((event, index) => {
      try {
        this.validateEvent(event, index)
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          errors.push(error)
        }
      }
    })

    // Validate network
    if (config.network) {
      try {
        this.validateNetwork(config.network)
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          errors.push(error)
        }
      }
    }

    if (errors.length > 0) {
      const errorMessage = errors
        .map((e) => {
          let msg = e.message
          if (e.field) msg += ` (field: ${e.field})`
          if (e.suggestions?.length) {
            msg += `\nSuggestions:\n${e.suggestions.map((s) => `  - ${s}`).join('\n')}`
          }
          return msg
        })
        .join('\n\n')

      throw new ConfigValidationError(`Configuration validation failed:\n\n${errorMessage}`)
    }

    return config
  }

  /**
   * Normalize configuration (convert simple formats to full objects)
   */
  static normalizeConfig(config: BindexerConfig): BindexerConfig {
    const normalized = { ...config }

    // Normalize network
    if (typeof normalized.network === 'string') {
      const networkName = normalized.network
      const networkConfig = DEFAULT_NETWORKS[networkName]
      if (!networkConfig) {
        throw new ConfigValidationError(`Unknown network: ${networkName}`, 'network', [
          `Available networks: ${Object.keys(DEFAULT_NETWORKS).join(', ')}`,
        ])
      }
      normalized.network = { ...networkConfig }

      // Apply RPC URL from environment if set
      if (process.env.RPC_URL || process.env.BINDEXER_RPC_URL) {
        ;(normalized.network as NetworkConfig).rpcUrl =
          process.env.RPC_URL || process.env.BINDEXER_RPC_URL
      }
    }

    // Normalize contracts
    normalized.contracts = config.contracts.map((contract, index) => {
      if (typeof contract === 'string') {
        return {
          address: contract,
          name: `Contract ${index + 1}`,
        } as ContractConfig
      }
      return contract as ContractConfig
    })

    // Normalize events
    normalized.events = config.events.map((event, index) => {
      if (typeof event === 'string') {
        return {
          signature: event,
          name: `Event ${index + 1}`,
        } as EventConfig
      }
      return event as EventConfig
    })

    // Normalize API config
    if (typeof normalized.api === 'boolean') {
      normalized.api = {
        enabled: normalized.api,
        port: 3000,
        host: 'localhost',
        cors: true,
      }
    }

    // Normalize database config
    if (typeof normalized.database === 'string') {
      normalized.database = {
        path: normalized.database,
        walMode: true,
        queryLogging: false,
      }
    }

    return normalized
  }

  /**
   * Merge two configuration objects with proper deep merging
   */
  static mergeConfigs(
    base: Partial<BindexerConfig>,
    override: Partial<BindexerConfig>
  ): Partial<BindexerConfig> {
    const result = { ...base }

    for (const [key, value] of Object.entries(override)) {
      if (value === undefined) continue

      if (Array.isArray(value)) {
        // For arrays, use override array (don't merge)
        ;(result as any)[key] = [...value]
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Deep merge objects
        const baseValue = (base as any)[key]
        if (typeof baseValue === 'object' && baseValue !== null && !Array.isArray(baseValue)) {
          ;(result as any)[key] = this.mergeConfigs(baseValue, value as any)
        } else {
          ;(result as any)[key] = { ...value }
        }
      } else {
        // Primitive values - override
        ;(result as any)[key] = value
      }
    }

    return result
  }

  /**
   * Generate a default configuration file
   */
  static generateDefaultConfig(template?: string): BindexerConfig {
    if (template) {
      return this.applyTemplate({} as BindexerConfig, template)
    }

    const config: BindexerConfig = {
      version: '1.0',
      project: 'my-blockchain-indexer',
      environment: 'development',
      network: 'sepolia',
      contracts: [
        {
          address: '0x...',
          name: 'MyContract',
          events: ['Transfer', 'Approval'],
        },
      ],
      events: [
        {
          signature: 'Transfer(address indexed from, address indexed to, uint256 value)',
          name: 'Transfer',
        },
      ],
      startBlock: 1000000,
      api: {
        enabled: true,
        port: 3000,
        cors: true,
      },
      database: {
        path: 'logs.sqlite',
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
    }

    return config
  }

  // Helper methods
  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private static setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    let current = obj

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {}
      }
      current = current[key]
    }

    current[keys[keys.length - 1]] = value
  }

  private static parseEnvValue(value: string): any {
    // Try to parse as JSON first
    if (
      value.startsWith('{') ||
      value.startsWith('[') ||
      value === 'true' ||
      value === 'false' ||
      /^\d+$/.test(value)
    ) {
      try {
        return JSON.parse(value)
      } catch {
        // Fall through to string parsing
      }
    }

    // Parse common boolean values
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false

    // Parse numbers
    if (/^\d+$/.test(value)) return parseInt(value, 10)
    if (/^\d*\.\d+$/.test(value)) return parseFloat(value)

    return value
  }

  private static validateContract(contract: string | ContractConfig, index: number): void {
    const address = typeof contract === 'string' ? contract : contract.address

    if (!address) {
      throw new ConfigValidationError(
        `Contract ${index + 1} is missing address`,
        `contracts[${index}].address`
      )
    }

    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ConfigValidationError(
        `Contract ${index + 1} has invalid address format: ${address}`,
        `contracts[${index}].address`,
        ['Address must be a valid Ethereum address (0x followed by 40 hex characters)']
      )
    }
  }

  private static validateEvent(event: string | EventConfig, index: number): void {
    const signature = typeof event === 'string' ? event : event.signature

    if (!signature) {
      throw new ConfigValidationError(
        `Event ${index + 1} is missing signature`,
        `events[${index}].signature`
      )
    }

    // Basic event signature validation
    if (!signature.includes('(') || !signature.includes(')')) {
      throw new ConfigValidationError(
        `Event ${index + 1} has invalid signature format: ${signature}`,
        `events[${index}].signature`,
        ['Event signature must be in format: EventName(type1,type2,...)']
      )
    }
  }

  private static validateNetwork(network: string | NetworkConfig): void {
    if (typeof network === 'string') {
      if (!DEFAULT_NETWORKS[network]) {
        throw new ConfigValidationError(`Unknown network: ${network}`, 'network', [
          `Available networks: ${Object.keys(DEFAULT_NETWORKS).join(', ')}`,
        ])
      }
    } else {
      if (!network.name || !network.chainId) {
        throw new ConfigValidationError(
          'Custom network configuration must include name and chainId',
          'network'
        )
      }
    }
  }

  private static applyTemplate(config: BindexerConfig, template: string): BindexerConfig {
    // Import templates dynamically to avoid circular dependencies
    const { getTemplate, getTemplateNames } = require('../templates/index')

    const templateConfig = getTemplate(template)
    if (!templateConfig) {
      const availableTemplates = getTemplateNames().join(', ')
      throw new ConfigValidationError(`Unknown template: ${template}`, 'template', [
        `Available templates: ${availableTemplates}`,
      ])
    }

    console.log(`📋 Applying template: ${templateConfig.name}`)
    console.log(`📝 Description: ${templateConfig.description}`)

    if (templateConfig.instructions) {
      console.log('\n📖 Setup Instructions:')
      templateConfig.instructions.forEach((instruction: string, index: number) => {
        console.log(`  ${index + 1}. ${instruction}`)
      })
    }

    return { ...config, ...templateConfig.config }
  }
}
