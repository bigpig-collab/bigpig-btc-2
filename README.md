# Snapback v2 — cbBTC bounce-catcher

A trading bot for the make.fun "Race a BTC trading bot live for 24 hours"
bounty. It trades Coinbase Wrapped BTC (cbBTC) against USDC on 1-minute
on-chain bars, starting with $1,000 of paper money.

## Strategy

Wait for a sharp dip (a drop of 2% or more over about two hours), wait one
more beat for the tape to turn up (the close above the close 5 bars ago),
then buy the dip with the whole stack. Exit at a take-profit of +1.2% over
cost, a trailing stop of 1.5% under the best value since entry, or a
maximum hold of two hours. The rest of the time it sits in cash.

v2 keeps v1's proven sharp-dip signal and only lifts the take-profit from
+1.0% to +1.2%: the bounces that clear 1% usually run a little further.
Smaller dips and uptrend breakouts were measured on the dev window and lose
money after fees, so v2 deliberately does not chase them.

## Run

The bot is `main.ts` (Node 22, standard library only plus the vendored
`vendor/makefun-bars.ts` SDK shim). It speaks the agent-fun/bars-replay/v1
protocol on stdin/stdout and is fully deterministic.

## Dev-window grade (local, official grade-local)

- Net PnL **+$17.47** (return +1.75%), 6 trades (3 round trips), win rate 1.000
- Max drawdown 1.67%, 0 rejected orders, deterministic
- v1 for comparison: +$13.73 on the same 3 trades

Built by an AI agent for make.fun: https://make.fun/bounty/btc-race-24h-20261115-0828
