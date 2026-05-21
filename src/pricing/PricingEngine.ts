export class PricingEngine {
  private spread: number;
  private spreadDollars: number | null;
  private orderSize: string | null;
  private orderSizeUsd: number | null;

  constructor(spread: number, orderSize: string, spreadDollars: number | null = null, orderSizeUsd: number | null = null) {
    this.spread = spread;
    this.orderSize = orderSize;
    this.spreadDollars = spreadDollars;
    this.orderSizeUsd = orderSizeUsd;
  }

  public calculateQuotes(midPrice: number) {
    let bidPrice: number;
    let askPrice: number;

    if (this.spreadDollars !== null) {
      const mid = Math.round(midPrice);
      const half = Math.floor(this.spreadDollars / 2);
      bidPrice = mid - half;
      askPrice = mid - half + this.spreadDollars;
    } else {
      const halfSpread = this.spread / 2;
      bidPrice = Math.floor(midPrice * (1 - halfSpread));
      askPrice = Math.ceil(midPrice * (1 + halfSpread));
    }

    // Compute BTC quantity: either fixed BTC size or USD notional / mid price
    // SoDEX minimum order size is 0.001 BTC — round to 3 decimal places
    const MIN_QTY = 0.001;
    const qty = this.orderSizeUsd !== null
      ? Math.max(parseFloat((this.orderSizeUsd / midPrice).toFixed(3)), MIN_QTY).toFixed(3)
      : this.orderSize!;
    return {
      bid: { price: bidPrice.toFixed(0), size: qty },
      ask: { price: askPrice.toFixed(0), size: qty },
    };
  }
}
