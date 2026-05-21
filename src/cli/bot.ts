import { config } from 'dotenv';
import { SodexClient } from '../sdk/SodexClient';
import { PricingEngine } from '../pricing/PricingEngine';
import { MarketMaker } from '../bots/mm/MarketMaker';

// Load environment variables
config();

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const REST_API_URL = process.env.REST_API_URL || 'https://mainnet-gw.sodex.dev/api/v1/perps';
const WS_API_URL = process.env.WS_API_URL || 'wss://mainnet-gw.sodex.dev/ws/perps';

const ACCOUNT_ID = parseInt(process.env.ACCOUNT_ID || '0');
const SYMBOL_ID = parseInt(process.env.SYMBOL_ID || '1');
const SYMBOL = process.env.SYMBOL || 'BTC-USD';
const SPREAD = parseFloat(process.env.SPREAD || '0.001');
const SPREAD_DOLLARS = process.env.SPREAD_DOLLARS ? parseInt(process.env.SPREAD_DOLLARS) : null;
const ORDER_SIZE = process.env.ORDER_SIZE || '0.1';
const ORDER_SIZE_USD = process.env.ORDER_SIZE_USD ? parseFloat(process.env.ORDER_SIZE_USD) : null;
const QUOTE_INTERVAL_MS = parseInt(process.env.QUOTE_INTERVAL_MS || '5000');
const MAX_POSITION_ORDERS = parseInt(process.env.MAX_POSITION_ORDERS || '2');

if (!API_KEY || !API_SECRET || !ACCOUNT_ID) {
  console.error('Missing API_KEY, API_SECRET, or ACCOUNT_ID in environment variables');
  process.exit(1);
}

async function main() {
  console.log('Initializing Live SoDEX Market Maker...');

  const client = new SodexClient(REST_API_URL, WS_API_URL, API_KEY!, API_SECRET!, ACCOUNT_ID);
  const pricing = new PricingEngine(SPREAD, ORDER_SIZE, SPREAD_DOLLARS, ORDER_SIZE_USD);
  
  const mm = new MarketMaker(client, pricing, SYMBOL, SYMBOL_ID, QUOTE_INTERVAL_MS, MAX_POSITION_ORDERS);
  
  await mm.start();
  
  console.log('Live Market Maker is running and waiting for WS ticker data. Press Ctrl+C to exit.');
}

main().catch((err) => {
  console.error('Fatal error starting bot:', err);
});
