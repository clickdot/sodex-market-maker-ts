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

  // Inventory tracking
  // netPosition > 0 = net long (filled buys > filled sells)
  // netPosition < 0 = net short (filled sells > filled buys)
  private netPosition: number = 0;
  private maxPositionOrders: number;

  constructor(
    client: SodexClient,
    pricing: PricingEngine,
    symbol: string,
    symbolId: number,
    quoteIntervalMs = 5000,
    maxPositionOrders = 2
  ) {
    this.client = client;
    this.pricing = pricing;
    this.symbol = symbol;
    this.symbolId = symbolId;
    this.quoteIntervalMs = quoteIntervalMs;
    this.maxPositionOrders = maxPositionOrders;
  }

  public async start() {
    console.log(`[MarketMaker] Starting for ${this.symbol} (SymbolID: ${this.symbolId})`);
    console.log(`[MarketMaker] Re-quoting every ${this.quoteIntervalMs / 1000}s | Max position: ±${this.maxPositionOrders} orders`);

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

    // Continuous re-quoting loop
    setInterval(async () => {
      if (this.currentMidPrice === 0) {
        console.log('[MarketMaker] Waiting for first price from WebSocket...');
        return;
      }
      await this.updateQuotes();
    }, this.quoteIntervalMs);
  }

  private handleWsMessage(payload: any) {
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

      const canBid = this.netPosition < this.maxPositionOrders;
      const canAsk = this.netPosition > -this.maxPositionOrders;

      console.log(
        `[MarketMaker] Mid=${this.currentMidPrice} | BID=${bid.price} ASK=${ask.price} | ` +
        `Position=${this.netPosition}/${this.maxPositionOrders} | ` +
        `Quoting: ${canBid ? 'BID✅' : 'BID🚫'} ${canAsk ? 'ASK✅' : 'ASK🚫'}`
      );

      // --- Cancel previous bid ---
      if (this.activeBidId) {
        const wasCancelled = await this.client.cancelOrders(this.symbolId, this.activeBidId);
        if (!wasCancelled) {
          // Order was filled — we're now more long
          this.netPosition++;
          console.log(`[MarketMaker] BID filled! Net position: ${this.netPosition}`);
        }
        this.activeBidId = null;
      }

      // --- Cancel previous ask ---
      if (this.activeAskId) {
        const wasCancelled = await this.client.cancelOrders(this.symbolId, this.activeAskId);
        if (!wasCancelled) {
          // Order was filled — we're now more short
          this.netPosition--;
          console.log(`[MarketMaker] ASK filled! Net position: ${this.netPosition}`);
        }
        this.activeAskId = null;
      }

      // Re-evaluate after fills
      const shouldBid = this.netPosition < this.maxPositionOrders;
      const shouldAsk = this.netPosition > -this.maxPositionOrders;

      // --- Place new BID if under long limit ---
      if (shouldBid) {
        const bidClOrdID = await this.client.placeOrder(this.symbolId, 1, bid.price, bid.size);
        if (bidClOrdID) this.activeBidId = bidClOrdID;
      } else {
        console.log(`[MarketMaker] ⚠️  Max long position reached (${this.netPosition}). Skipping BID.`);
      }

      // --- Place new ASK if under short limit ---
      if (shouldAsk) {
        const askClOrdID = await this.client.placeOrder(this.symbolId, 2, ask.price, ask.size);
        if (askClOrdID) this.activeAskId = askClOrdID;
      } else {
        console.log(`[MarketMaker] ⚠️  Max short position reached (${this.netPosition}). Skipping ASK.`);
      }

    } catch (e: any) {
      console.error(`[MarketMaker] Error updating quotes: ${e.message}`);
    } finally {
      this.isUpdating = false;
    }
  }
}
