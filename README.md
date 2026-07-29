# TrustlessAgent

TrustlessAgent is an agent-deliverable escrow for GenLayer: a buyer funds a deal, a seller submits deliverable evidence, validators judge whether the work meets the agreed terms, and the contract releases funds or refunds the buyer.

Public repository: https://github.com/duclucky/TrustlessAgent

Live app: https://trustlessagent-omega.vercel.app

Contract address: `0x59e470473966A0E97A5DF236D5ff349ecCef7080` on GenLayer studionet.

Explorer: https://genlayer-explorer.vercel.app/address/0x59e470473966A0E97A5DF236D5ff349ecCef7080

## Problem

Agent-to-agent commerce needs more than a payment rail. A buyer should not have to pay before seeing useful work, and a seller should not have to trust a buyer who can copy the work and falsely reject it. A deterministic contract can custody tokens, but it cannot inspect a repository, API, document, or hosted artifact and decide whether the deliverable satisfies natural-language terms.

## Contract

The repository now implements the requested buyer, seller, deliverable terms, escrow funding, and release or refund workflow in one GenLayer Intelligent Contract:

- `contracts/AgentDeliverableEscrow.py`

Core lifecycle:

1. `open_deal(seller, terms, evidence_requirements, deadline_ts)` is payable. The buyer sends GEN with the call, and the contract stores buyer, seller, terms, deadline, and `escrow_amount`.
2. `submit_deliverable(deal_id, deliverable_urls)` lets the seller submit bounded public evidence URLs.
3. `adjudicate_delivery(deal_id)` runs GenLayer nondeterminism. Validators fetch the deliverable evidence with `gl.nondet.web.render`, ask an LLM for a constrained verdict, and compare consensus-critical meaning: verdict, whether terms are met, and whether evidence is accessible.
4. `release_deal(deal_id)` pays the seller after a `DELIVERED` verdict with sufficient confidence.
5. `claim_refund(deal_id)` refunds the buyer after a failed/insufficient verdict or after the contract's deterministic transaction time reaches the deadline.

The payout path uses native GEN value custody through `@gl.public.write.payable`, `gl.message.value`, an internal escrow ledger, deterministic GenVM transaction time for deadline checks, and finalized `emit_transfer` messages. Settlement zeroes the stored escrow amount before transfer to prevent double release or double refund.

## State Model

Deal status values:

- `FUNDED`
- `SUBMITTED`
- `RELEASE_APPROVED`
- `REFUND_APPROVED`
- `RELEASED`
- `REFUNDED`

Verdict values:

- `DELIVERED`
- `FAILED`
- `INSUFFICIENT`

Views:

- `get_deal(deal_id)`
- `get_terms(deal_id)`
- `get_deliverable(deal_id)`
- `get_reason(deal_id)`
- `get_deal_count()`

## Frontend

The Vite app in `frontend/` is wired to the escrow contract on GenLayer studionet. It reads canonical deal state and sends the core write calls:

- open funded escrow;
- submit deliverable evidence;
- adjudicate delivery;
- release escrow;
- refund escrow.

Set the deployed address after deployment:

```bash
cd frontend
echo VITE_CONTRACT_ADDRESS=0xYourDeployedContract > .env
npm install
npm run build
```

## Local Verification

```bash
npm run check
```

This runs the repository's static escrow checks and the frontend production build.

## Studionet Evidence

Sanitized lifecycle evidence is stored in `docs/evidence/studionet/deployment.json`. The active contract has two verified value-bearing paths:

- Refund path, `deal-0`: buyer funded `0.01 GEN`, seller submitted `https://example.com`, validator adjudication returned `FAILED`, and `claim_refund` moved the deal to `REFUNDED` with escrow amount `0`.
- Release path, `deal-1`: buyer funded `0.01 GEN`, seller submitted `https://trustlessagent-omega.vercel.app/weather-agent-deliverable.txt`, validator adjudication returned `DELIVERED`, and `release_deal` moved the deal to `RELEASED` with escrow amount `0`.

Release path transaction hashes:

- open: `0xf9ee662d9bf9a9853c853650ccf5dc2ba40787210eed6183de0c25193894ed81`
- submit: `0xa0d89a5e1015298089765fce99a730526577680f95c09dc2dd0239c3d1e82f2e`
- adjudicate: `0x3aa4109cd6ae551b284baea674c84c2e4154bd8c63fda8b7631244772ff917bc`
- release: `0x725a3784bb870336a9547e39f714578b036ea52707f15f8cdeb8d9cf516205a1`

## Current Evidence Boundary

This source fixes the architectural mismatch identified by reviewers. The contract is deployed on GenLayer studionet. Funded lifecycles were exercised with buyer `0xC495...7272` and seller `0x45aD...39Db` for both outcomes: failed evidence refunds the buyer, and delivered evidence releases escrow to the seller. Browser-wallet write evidence is still not claimed; the Studionet lifecycle evidence above is script-signed with the authorized local wallets.
