export class PricingEngine {
  private spread: number;
  private spreadDollars: number | null;
  private orderSize: string;

  constructor(spread: number, orderSize: string, spreadDollars: number | null = null) {
    this.spread = spread;
    this.orderSize = orderSize;
    this.spreadDollars = spreadDollars;
  }

  public calculateQuotes(midPrice: number) {
    let bidPrice: number;
    let askPrice: number;

    if (this.spreadDollars !== null) {
      // Fixed dollar spread: bid = floor(mid), ask = floor(mid) + spreadDollars
      const mid = Math.round(midPrice);
      const half = Math.floor(this.spreadDollars / 2);
      bidPrice = mid - half;
      askPrice = mid - half + this.spreadDollars;
    } else {
      // Percentage spread
      const halfSpread = this.spread / 2;
      bidPrice = Math.floor(midPrice * (1 - halfSpread));
      askPrice = Math.ceil(midPrice * (1 + halfSpread));
    }

    return {
      bid: { price: bidPrice.toFixed(0), size: this.orderSize },
      ask: { price: askPrice.toFixed(0), size: this.orderSize },
    };
  }
}
