# Bindexer

A powerful Ethereum event indexer built with Bun and TypeScript. Bindexer monitors blockchain events from multiple contracts across different networks and stores them in SQLite for efficient querying and analysis.

## 🚀 Features

- **Multi-network support** - Mainnet, Sepolia, Polygon, Arbitrum, and more
- **Advanced configuration** - Profiles, templates, environment variables
- **Flexible CLI** - Initialize projects, validate configs, generate templates
- **REST API** - Query indexed events with CORS, rate limiting, and authentication
- **High performance** - Built with Bun and optimized batch processing
- **Smart retries** - Configurable retry strategies for reliability
- **Historical sync** - Process events from specified starting blocks
- **Template system** - Quick setup for popular contract types (ERC20, Uniswap, etc.)

## 📋 Prerequisites

- [Bun](https://bun.sh/) runtime installed
- Basic knowledge of Ethereum contracts and events

## 🔧 Installation

```bash
# Clone the repository
git clone https://github.com/uditdc/bindexer.git
cd bindexer

# Install dependencies
bun install
```

## 🚀 Quick Start

### Initialize a new project

```bash
# Create a new project with default configuration
bun run src/index.ts --init

# Create project with specific template
bun run src/index.ts --init --template=erc20
bun run src/index.ts --init --template=uniswap-v3
```

### Run with configuration file

```bash
# Use default config (bindexer.config.json)
bun run src/index.ts

# Use specific config file
bun run src/index.ts --config=my-project.json

# Use environment profile
bun run src/index.ts --profile=production
```

### Run with CLI arguments

```bash
bun run src/index.ts \
  --contract=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --event="Transfer(address indexed,address indexed,uint256)" \
  --network=mainnet \
  --api --port=3000
```

## 🖥️ CLI Reference

### Commands

| Command | Description |
| ------- | ----------- |
| `(default)` | Start the event indexer |
| `--init [--template=<name>]` | Initialize new project with config file |
| `--generate-config` | Generate configuration to stdout |
| `--validate` | Validate existing configuration |
| `--help` | Show help message |
| `--version` | Show version information |

### Core Options

| Flag | Long Form | Description |
| ---- | --------- | ----------- |
| `-c` | `--contract <address>` | Contract address to monitor (multiple allowed) |
| `-e` | `--event <signature>` | Event signature to monitor (multiple allowed) |
| `-n` | `--network <name>` | Network: mainnet, sepolia, polygon, arbitrum |
| `-s` | `--startBlock <number>` | Starting block for historical sync |

### Configuration Options

| Flag | Long Form | Description |
| ---- | --------- | ----------- |
| `-f` | `--config <path>` | Path to config file |
| `--profile <name>` | Use specific config profile/environment |
| `-t` | `--template <name>` | Template for --init command |

### API Options

| Flag | Long Form | Description |
| ---- | --------- | ----------- |
| `-a` | `--api` | Enable API server |
| `-p` | `--port <number>` | API server port (default: 3000) |
| `--host <address>` | API server host (default: localhost) |

### Database & Monitoring

| Flag | Long Form | Description |
| ---- | --------- | ----------- |
| `-d` | `--database <path>` | Database file path (default: logs.sqlite) |
| `--logLevel <level>` | Log level: debug, info, warn, error |
| `-v` | `--verbose` | Enable verbose logging (debug level) |
| `-q` | `--quiet` | Enable quiet mode (error level only) |

## ⚙️ Configuration

### Configuration File Structure

```json
{
  "version": "1.0",
  "project": "my-indexer-project",
  "environment": "development",
  
  "network": {
    "name": "mainnet",
    "chainId": 1,
    "rpcUrl": "https://eth.llamarpc.com"
  },
  
  "contracts": [
    {
      "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "name": "USDC",
      "startBlock": 20000000
    }
  ],
  
  "events": [
    {
      "signature": "Transfer(address indexed,address indexed,uint256)",
      "name": "Transfer"
    }
  ],
  
  "api": {
    "enabled": true,
    "port": 3000,
    "host": "localhost",
    "cors": true,
    "rateLimit": {
      "windowMs": 60000,
      "max": 100
    }
  },
  
  "database": {
    "path": "logs.sqlite",
    "walMode": true,
    "queryLogging": false
  },
  
  "monitoring": {
    "logLevel": "info",
    "progressTracking": true,
    "performanceMetrics": true
  },
  
  "profiles": {
    "production": {
      "environment": "production",
      "network": "mainnet",
      "monitoring": {
        "logLevel": "warn"
      }
    }
  }
}
```

### Environment Variables

| Variable | Description |
| -------- | ----------- |
| `BINDEXER_NETWORK` | Default network |
| `BINDEXER_RPC_URL` | RPC endpoint URL |
| `BINDEXER_START_BLOCK` | Starting block number |
| `BINDEXER_API_PORT` | API server port |
| `BINDEXER_DATABASE_PATH` | Database file path |
| `BINDEXER_LOG_LEVEL` | Logging level |
| `RPC_URL` | RPC endpoint (alias) |

### Supported Networks

| Network | Chain ID | Default RPC |
| ------- | -------- | ----------- |
| `mainnet` | 1 | https://eth.llamarpc.com |
| `sepolia` | 11155111 | https://ethereum-sepolia-rpc.publicnode.com |
| `holesky` | 17000 | https://ethereum-holesky-rpc.publicnode.com |
| `polygon` | 137 | https://polygon-rpc.com |
| `arbitrum` | 42161 | https://arb1.arbitrum.io/rpc |

## 🌐 API Endpoints

When the API server is enabled:

### Get All Events
```bash
curl -X GET http://localhost:3000/api/events
```

### Get Events by Type
```bash
curl -X GET http://localhost:3000/api/events/Transfer
```

### Get Event Types
```bash
curl -X GET http://localhost:3000/api/event-types
```

### Response Format
```json
[
  {
    "id": 1,
    "eventType": "Transfer",
    "contract": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "blockNumber": 123456,
    "transactionHash": "0xabcdef...",
    "param_0_address": "0x1111111111111111111111111111111111111111",
    "param_1_address": "0x2222222222222222222222222222222222222222",
    "param_2_uint256": "1000000000000000000",
    "timestamp": "2024-01-01T12:00:00Z"
  }
]
```

## 🛠️ Development

### Project Structure

```
bindexer/
├── src/
│   ├── index.ts              # Main entry point
│   ├── cli.ts                # CLI argument parsing
│   ├── server.ts             # API server
│   ├── logs.ts               # Event processing
│   ├── types/
│   │   └── config.ts         # Configuration types
│   ├── utils/
│   │   ├── configManager.ts  # Configuration management
│   │   ├── dbClient.ts       # Database operations
│   │   ├── logger.ts         # Logging utilities
│   │   ├── seeder.ts         # Database seeding
│   │   └── viemClient.ts     # Ethereum client
│   └── templates/            # Project templates
├── bindexer.config.json      # Configuration file
├── package.json              # Dependencies
└── tsconfig.json             # TypeScript config
```

### Development Commands

```bash
# Run in development mode
bun run dev

# Format code
bun run format

# Build TypeScript
bun run build

# Validate configuration
bun run src/index.ts --validate
```

### Creating Templates

Templates are located in `src/templates/` and help users quickly set up common configurations:

- `erc20` - Standard ERC20 token monitoring
- `uniswap-v3` - Uniswap V3 pool events
- `defi` - Common DeFi protocol events

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
For major changes, please open an issue first to discuss what you would like to change.
