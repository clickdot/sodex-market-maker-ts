export class PricingEngine {
  private spread: number;
  private orderSize: string;

  constructor(spread: number, orderSize: string) {
    this.spread = spread;
    this.orderSize = orderSize;
  }

  public calculateQuotes(midPrice: number) {
    const halfSpread = this.spread / 2;
    const bidPrice = Math.floor(midPrice * (1 - halfSpread));  // round DOWN for bids
    const askPrice = Math.ceil(midPrice * (1 + halfSpread));   // round UP for asks

    // BTC-USD tick size is $1 — use whole number strings
    return {
      bid: {
        price: bidPrice.toFixed(0),
        size: this.orderSize,
      },
      ask: {
        price: askPrice.toFixed(0),
        size: this.orderSize,
      },
    };
  }
}
