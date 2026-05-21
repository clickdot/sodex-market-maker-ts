# SoDEX Market Maker

A TypeScript market maker bot for [SoDEX](https://sodex.com) Perpetuals, inspired by [zo-market-maker-ts](https://github.com/yat1ma30/zo-market-maker-ts).

## Features
- Live price feed via SoDEX WebSocket (`ticker` channel)
- Continuous two-sided quoting (bid + ask) on a configurable interval
- EIP-712 signed order submission via SoDEX REST API
- Automatic cancellation and refresh of stale quotes

## Setup

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Configure**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your credentials:
   ```
   API_KEY=SODEX_API_KEY          # Name of your API key from SoDEX UI
   API_SECRET=0x...               # Your API private key
   ACCOUNT_ID=121401              # Your SoDEX perps account ID
   SYMBOL_ID=1                    # 1 = BTC-USD
   SYMBOL=BTC-USD
   SPREAD=0.001                   # 0.1% spread (half each side)
   ORDER_SIZE=0.1                 # Size in BTC
   QUOTE_INTERVAL_MS=5000         # Re-quote every 5 seconds
   ```

3. **Build and run**
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `API_KEY` | API key name from SoDEX UI | required |
| `API_SECRET` | API private key (hex) | required |
| `ACCOUNT_ID` | SoDEX perps account integer ID | required |
| `SYMBOL_ID` | Instrument integer ID (1=BTC-USD) | `1` |
| `SYMBOL` | Trading pair string | `BTC-USD` |
| `SPREAD` | Total spread as decimal (0.001 = 0.1%) | `0.001` |
| `ORDER_SIZE` | Order size in base asset | `0.1` |
| `QUOTE_INTERVAL_MS` | Re-quote interval in ms | `5000` |

## How It Works

1. Connects to `wss://mainnet-gw.sodex.dev/ws/perps` and subscribes to the `ticker` channel
2. Every `QUOTE_INTERVAL_MS` ms, cancels previous quotes and places fresh bid + ask around the live mid price
3. Orders are signed using EIP-712 typed data with your API private key
