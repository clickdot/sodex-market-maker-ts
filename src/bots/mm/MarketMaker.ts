import { SodexClient } from '../../sdk/SodexClient';
import { PricingEngine } from '../../pricing/PricingEngine';

export class MarketMaker {
  private client: SodexClient;
  private pricing: PricingEngine;
  private symbol: string;
  private symbolId: number;
  private currentMidPrice: number = 0;
  private isUpdating: boolean = false;
  private activeBidId: string | null = null;
  private activeAskId: string | null = null;
  private quoteIntervalMs: number;

  constructor(client: SodexClient, pricing: PricingEngine, symbol: string, symbolId: number, quoteIntervalMs = 5000) {
    this.client = client;
    this.pricing = pricing;
    this.symbol = symbol;
    this.symbolId = symbolId;
    this.quoteIntervalMs = quoteIntervalMs;
  }

  public async start() {
    console.log(`[MarketMaker] Starting for ${this.symbol} (SymbolID: ${this.symbolId})`);
    console.log(`[MarketMaker] Re-quoting every ${this.quoteIntervalMs / 1000}s`);

    // Connect WS and subscribe to live ticker
    this.client.connectWs((data) => this.handleWsMessage(data));
    setTimeout(() => {
      console.log(`[MarketMaker] Subscribing to ticker for ${this.symbol}`);
      this.client.sendWs({
        op: 'subscribe',
        id: 1,
        params: { channel: 'ticker', symbols: [this.symbol] }
      });
    }, 1000);

    // Continuous re-quoting loop — fires every quoteIntervalMs
    setInterval(async () => {
      if (this.currentMidPrice === 0) {
        console.log('[MarketMaker] Waiting for first price from WebSocket...');
        return;
      }
      await this.updateQuotes();
    }, this.quoteIntervalMs);
  }

  private handleWsMessage(payload: any) {
    // WsTickerData: {"channel":"ticker", "data": [{"s":"BTC-USD", "c":"77500", "a":"77501", "b":"77499", ...}]}
    if (payload.channel === 'ticker' && Array.isArray(payload.data)) {
      const tick = payload.data[0];
      if (tick && tick.s === this.symbol && tick.c) {
        const newMid = parseFloat(tick.c);
        if (newMid > 0) {
          this.currentMidPrice = newMid;
        }
      }
    }
  }

  private async updateQuotes() {
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      const { bid, ask } = this.pricing.calculateQuotes(this.currentMidPrice);

      console.log(`[MarketMaker] Mid=${this.currentMidPrice} | BID=${bid.price} ASK=${ask.price} size=${bid.size}`);

      // Cancel previous orders before placing fresh ones
      if (this.activeBidId) {
        await this.client.cancelOrders(this.symbolId, this.activeBidId);
        this.activeBidId = null;
      }
      if (this.activeAskId) {
        await this.client.cancelOrders(this.symbolId, this.activeAskId);
        this.activeAskId = null;
      }

      // Place new BID (side=1) and ASK (side=2)
      const bidClOrdID = await this.client.placeOrder(this.symbolId, 1, bid.price, bid.size);
      const askClOrdID = await this.client.placeOrder(this.symbolId, 2, ask.price, ask.size);

      // Track IDs for next cycle's cancellation
      if (bidClOrdID) this.activeBidId = bidClOrdID;
      if (askClOrdID) this.activeAskId = askClOrdID;

    } catch (e: any) {
      console.error(`[MarketMaker] Error updating quotes: ${e.message}`);
    } finally {
      this.isUpdating = false;
    }
  }
}
