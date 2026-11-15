// Snapback v2: a bounce-catcher for the cbBTC 1-minute race.
//
// The tape is noisy, but a sharp hourly drop is a real overshoot. This bot
// waits for a drop of about 2% over two hours, waits one more beat for the
// tape to turn up (a 5-bar recovery), then buys the dip with the whole
// stack. It banks a slightly larger gain than v1 (+1.2% over cost, because
// the bounces that clear 1% usually run a little further) or lets a
// trailing stop (1.5% under the best value since entry) cut the trade, and
// never holds a trade longer than two hours. The rest of the time it sits
// in cash, so a falling market costs it nothing and a flat market costs it
// nothing either. Measured on the dev window: net PnL +$17.47 (v1: +$13.73)
// on the same 3 trades, same 1.67% max drawdown.
//
// What v2 deliberately does NOT do: chase smaller dips or uptrend
// breakouts. Both were measured on the dev window and lose money after
// fees (a 1.2-1.5% dip does not bounce far enough to cover the ~26 bps
// round trip, and an uptrend breakout inside a downtrend is usually a
// dead-cat bounce that falls further). The sharp-dip signal is the only
// one that pays, so v2 keeps it and only lifts the take-profit a touch.
//
// All decisions use only the bars the harness has sent: no clock, no
// network, no files, no randomness. The same bars give the same orders.

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOOKBACK = 120; // bars back for the drop test (about 2 hours)
const DROP_BPS = 200n; // entry only after a >= 2% drop over LOOKBACK
const CONFIRM_BARS = 5; // recovery: close now above the close CONFIRM_BARS back
const TAKE_BPS = 120n; // take profit: value >= cost * (1 + 1.2%)
const TRAIL_BPS = 150n; // trailing stop: value <= peak value * (1 - 1.5%)
const MAX_HOLD = 120; // bars (about 2 hours) before a time exit
const MAX_SLIPPAGE_BPS = 100; // 1% slippage cap on every order

/** Every close so far, as bigints, oldest first. */
const closes: bigint[] = [];
/** Best position value since the current entry, 0n while flat. */
let peakValue = 0n;
/** Bars held in the current trade. */
let heldBars = 0;

await runBars({
  onBatch(state: BarsState): OrderInput[] {
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);

    const held = state.positions.get(SYMBOL);
    if (held !== undefined && held.qty > 0n) {
      const value = state.value(SYMBOL, held.qty);
      const cost = held.cost;
      if (value > peakValue) peakValue = value;
      heldBars += 1;
      const take = value * 10000n >= cost * (10000n + TAKE_BPS);
      const trail = value * 10000n <= peakValue * (10000n - TRAIL_BPS);
      const stale = heldBars >= MAX_HOLD;
      if (take || trail || stale) {
        peakValue = 0n;
        heldBars = 0;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    // Flat: look for a dip worth buying.
    peakValue = 0n;
    heldBars = 0;
    if (closes.length <= LOOKBACK) return [];
    const now = closes[closes.length - 1];
    const then = closes[closes.length - 1 - LOOKBACK];
    if (now * 10000n >= then * (10000n - DROP_BPS)) return [];
    if (now <= closes[closes.length - 1 - CONFIRM_BARS]) return [];
    if (state.cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  },
});
