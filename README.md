# Bindexer

A lightweight Ethereum event indexer built with Bun and TypeScript. This tool monitors blockchain events from specified contracts and stores them in a local SQLite database for easy querying.

## 🚀 Features

- Monitor multiple Ethereum contracts for specific events
- Automatically generate database schemas based on event ABIs
- Query indexed events via a REST API
- Configure via command line arguments or JSON config file
- Built with Bun for fast performance

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

## 🖥️ Usage

### Basic Usage

Run the indexer with a configuration file:

```bash
bun run src/index.ts -f config.json
```

### Command Line Arguments

Run the indexer with command line arguments:

```bash
bun run src/index.ts -c 0x1234567890123456789012345678901234567890 -e "Transfer(address,address,uint256)" -p 3000 -a
```

#### Available Options

| Flag | Long Form    | Description                                                | Required |
| ---- | ------------ | ---------------------------------------------------------- | -------- |
| `-c` | `--contract` | Contract address to monitor (can be used multiple times)   | Yes      |
| `-e` | `--event`    | Event signature to listen for (can be used multiple times) | Yes      |
| `-p` | `--port`     | Port to run the API server on (default: 3000)              | No       |
| `-a` | `--api`      | Enable the API server                                      | No       |
| `-f` | `--file`     | Path to configuration file                                 | No       |

### Config File

The config file is a JSON file that specifies the contracts to monitor, the events to listen for, and the port to run the API server on:

```json
{
  "contracts": ["0x1234567890123456789012345678901234567890"],
  "events": ["Transfer(address,address,uint256)"],
  "port": 3000,
  "api": true
}
```

## 🌐 API Endpoints

When the API server is enabled, the following endpoints are available:

### Get Events

Retrieve all indexed events from the database:

```bash
curl -X GET http://localhost:3000/api/events
```

Response:

```json
[
  {
    "id": 1,
    "eventType": "Transfer",
    "contract": "0x1234567890123456789012345678901234567890",
    "blockNumber": 123456,
    "transactionHash": "0xabcdef...",
    "param_0_address": "0x1111111111111111111111111111111111111111",
    "param_1_address": "0x2222222222222222222222222222222222222222",
    "param_2_uint256": "1000000000000000000"
  }
  // ...
]
```

### Get Events by Type

Retrieve events of a specific type:

```bash
curl -X GET http://localhost:3000/api/events/Transfer
```

### Get Event Types

Get all available event types:

```bash
curl -X GET http://localhost:3000/api/event-types
```

Response:

```json
["Transfer", "Approval", "Mint"]
```

## 🧪 Testing

Run the test suite:

```bash
bun test
```

## 🛠️ Development

### Project Structure

```
bindexer/
├── src/
│   ├── index.ts         # Entry point
│   ├── config.ts        # Configuration handling
│   ├── indexer.ts       # Event indexing logic
│   ├── db.ts            # Database operations
│   └── api.ts           # API server
├── tests/               # Test files
├── README.md            # This file
└── package.json         # Project dependencies
```

### Local Development

To run the indexer in development mode:

```bash
bun run dev
```

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
For major changes, please open an issue first to discuss what you would like to change.
