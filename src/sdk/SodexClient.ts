import axios from 'axios';
import { WebSocket } from 'ws';
import { ethers } from 'ethers';

export interface OrderParams {
  accountID: number;
  symbolID: number;
  orders: {
    clOrdID: string;
    modifier: number;
    side: number;
    type: number;
    timeInForce: number;
    price: string;
    quantity: string;
    reduceOnly: boolean;
    positionSide: number;
  }[];
}

export interface CancelParams {
  accountID: number;
  cancels: {
    symbolID: number;
    clOrdID: string;
  }[];
}

export class SodexClient {
  private restUrl: string;
  private wsUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private accountId: number;
  private wallet: ethers.Wallet;
  private ws: WebSocket | null = null;
  private orderCounter: number = 0;

  constructor(restUrl: string, wsUrl: string, apiKey: string, apiSecret: string, accountId: number) {
    this.restUrl = restUrl;
    this.wsUrl = wsUrl;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.accountId = accountId;
    this.wallet = new ethers.Wallet(apiSecret);
  }

  private generateNonce(): number {
    return Date.now();
  }

  private async signPayload(actionType: string, params: any, nonce: number): Promise<string> {
    const payload = {
      type: actionType,
      params: params
    };

    // Compact JSON stringify (no spaces)
    const jsonString = JSON.stringify(payload);
    // keccak256 hash of the JSON string bytes
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(jsonString));

    const domain = {
      name: 'futures',
      version: '1',
      chainId: 286623, // Mainnet
      verifyingContract: '0x0000000000000000000000000000000000000000',
    };

    const types = {
      ExchangeAction: [
        { name: 'payloadHash', type: 'bytes32' },
        { name: 'nonce', type: 'uint64' },
      ],
    };

    const message = {
      payloadHash: payloadHash,
      nonce: nonce,
    };

    const rawSignature = await this.wallet.signTypedData(domain, types, message);
    
    // Correct format: 0x01 + r(32 bytes) + s(32 bytes) + v adjusted (subtract 27)
    // rawSignature = 0x + r(64 hex) + s(64 hex) + v(2 hex) where v is 1b or 1c
    const vByte = parseInt(rawSignature.slice(-2), 16);
    const adjustedV = (vByte - 27).toString(16).padStart(2, '0');
    const signature = '0x01' + rawSignature.slice(2, -2) + adjustedV;
    return signature;
  }

  public async placeOrder(symbolId: number, side: number, price: string, size: string): Promise<string | null> {
    const nonce = this.generateNonce();
    this.orderCounter++;
    const clOrdID = `mm-${Date.now()}-${this.orderCounter}`;

    const params: OrderParams = {
      accountID: this.accountId,
      symbolID: symbolId,
      orders: [
        {
          clOrdID: clOrdID,
          modifier: 1,
          side: side,       // 1 = BUY, 2 = SELL
          type: 1,          // 1 = LIMIT
          timeInForce: 1,   // 1 = GTC
          price: price,
          quantity: size,
          reduceOnly: false,
          positionSide: 1   // 1 = BOTH
        }
      ]
    };

    const signature = await this.signPayload('newOrder', params, nonce);

    console.log(`[SodexClient] Placing ${side === 1 ? 'BUY' : 'SELL'} order for ${size} (Symbol ${symbolId}) @ ${price}`);
    try {
      const response = await axios.post(`${this.restUrl}/trade/orders`, params, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'X-API-Nonce': nonce.toString(),
          'X-API-Sign': signature,
        },
      });
      console.log(`[SodexClient] Order response:`, JSON.stringify(response.data));
      return clOrdID;
    } catch (error: any) {
      console.error('[SodexClient] Error placing order:', error.response?.data || error.message);
      return null;
    }
  }

  public async cancelOrders(symbolId: number, clOrdID: string): Promise<boolean> {
    const nonce = this.generateNonce();

    const params: CancelParams = {
      accountID: this.accountId,
      cancels: [
        {
          symbolID: symbolId,
          clOrdID: clOrdID
        }
      ]
    };

    const signature = await this.signPayload('cancelOrder', params, nonce);

    console.log(`[SodexClient] Canceling order ${clOrdID} for symbol ${symbolId}`);
    try {
      const response = await axios.delete(`${this.restUrl}/trade/orders`, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'X-API-Nonce': nonce.toString(),
          'X-API-Sign': signature,
        },
        data: params,
      });
      // Check if the cancel actually succeeded or if order was already filled
      const result = response.data?.data?.[0];
      if (result && result.code !== 0) {
        console.log(`[SodexClient] Order ${clOrdID} was already filled (code=${result.code}: ${result.error})`);
        return false; // filled
      }
      return true; // successfully cancelled
    } catch (error: any) {
      console.error('[SodexClient] Error canceling order:', error.response?.data || error.message);
      return false;
    }
  }

  public connectWs(onMessage: (data: any) => void) {
    console.log(`[SodexClient] Connecting to WS at ${this.wsUrl}`);
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      console.log('[SodexClient] WS Connected');
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const parsed = JSON.parse(data.toString());
        onMessage(parsed);
      } catch (e) {
        console.error('[SodexClient] Failed to parse WS message');
      }
    });

    this.ws.on('error', (err) => {
      console.error('[SodexClient] WS Error:', err.message);
    });

    this.ws.on('close', () => {
      console.log('[SodexClient] WS Disconnected. Reconnecting in 5s...');
      setTimeout(() => this.connectWs(onMessage), 5000);
    });
  }

  public sendWs(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}
