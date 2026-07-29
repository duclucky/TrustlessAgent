# TrustlessAgent Project Specification

## Summary

TrustlessAgent is a GenLayer agent-deliverable escrow. A buyer funds a deal, a seller submits public deliverable evidence, validators judge whether the evidence satisfies the agreed terms, and the contract either releases escrow to the seller or refunds the buyer.

## Seven-Part Fingerprint

- Trust problem: the buyer can falsely reject useful work after seeing it, while the seller can submit weak or unrelated work and demand payment.
- Actors/adversary: buyer and seller have opposing incentives around acceptance, evidence quality, and payout.
- Evidence class: bounded public deliverable URLs submitted by the seller and rendered by validators.
- Consensus question: whether the submitted deliverable is accessible and materially satisfies the agreed terms and evidence requirements.
- State machine: `FUNDED -> SUBMITTED -> RELEASE_APPROVED -> RELEASED` or `FUNDED/SUBMITTED -> REFUND_APPROVED -> REFUNDED`.
- Direct consequence: the finalized verdict controls native GEN escrow release or refund and zeroes the escrow ledger.
- Reuse surface: builders can call `open_deal`, `submit_deliverable`, `adjudicate_delivery`, `release_deal`, `claim_refund`, and read canonical views.

## Evidence Policy

Seller evidence is limited to at most four newline-separated public URLs. The contract renders each URL as text and passes the gathered content into a constrained JSON verdict prompt. Evidence that cannot be read leads to `INSUFFICIENT` and a refund path. Prompt-injection text inside evidence is explicitly ignored by the adjudication prompt and cannot expand the allowed verdict enum.

## Consensus And Equivalence

The leader and validators independently render the submitted evidence and run the same constrained task. Equivalence checks consensus-critical meaning:

- verdict enum: `DELIVERED`, `FAILED`, or `INSUFFICIENT`;
- whether the deliverable meets the agreed terms;
- whether evidence is accessible;
- whether the normalized verdict, accessibility, terms match, and confidence threshold map to the same release/refund consequence.

Rationale wording is stored for UX and review, but it is not exact-matched.

## State And Accounting Invariants

- Every deal is isolated by stable ID `deal-N`.
- Buyer and seller addresses are stored per deal.
- Only the seller can submit deliverables or release approved escrow.
- Only the buyer can claim a refund.
- Deadline refunds use deterministic GenVM transaction time, not a timestamp supplied by the buyer.
- Settlement sets `escrow_amount[deal_id]` to zero before native GEN transfer.
- Closed deals cannot be settled twice because `release_deal` and `claim_refund` require approved states.

## Claim-To-Code Matrix

| Claim | Contract method/state | View/read | Test | Network evidence |
| --- | --- | --- | --- | --- |
| Buyer funds escrow with terms and seller | `open_deal`, `buyer`, `seller`, `terms`, `escrow_amount`, `FUNDED` | `get_deal`, `get_terms` | `tests/escrow_static_test.mjs` payable/value/state checks | `docs/evidence/studionet/deployment.json` `deal-0` and `deal-1` open steps |
| Seller submits deliverable evidence | `submit_deliverable`, `deliverable_urls`, `SUBMITTED` | `get_deliverable`, `get_deal` | Static checks for method/frontend wiring | `deal-0` and `deal-1` submit txs |
| Validators judge public evidence inside GenLayer | `adjudicate_delivery`, `leader_fn`, `validator_fn`, `gl.nondet.web.render`, `gl.nondet.exec_prompt` | `get_deal`, `get_reason` | Static checks for nondet leader/validator and verdict enum | Refund adjudication `FAILED`; release adjudication `DELIVERED` |
| Failed/insufficient evidence refunds buyer | `REFUND_APPROVED`, `claim_refund`, `REFUNDED`, `emit_transfer` | `get_deal` escrow amount `0` | Static checks for refund workflow and transfer | `deal-0` refund tx `0x1b178f63cf8ef38385d390d3045c2ce50ea754f9495fd97ce39eeb095a43bfdc` |
| Delivered evidence releases seller payout | `RELEASE_APPROVED`, `release_deal`, `RELEASED`, `emit_transfer` | `get_deal` escrow amount `0` | Static checks for release workflow and transfer | `deal-1` release tx `0x08178eea0d2ca05cea164f873c0e2e10b3d4390c2d82667877ec7ee31b0c1d34` |
| Frontend reads and writes the deployed contract | `frontend/src/genlayer.js`, `frontend/src/App.jsx` write/read calls | UI calls `get_deal_count`, `get_deal`, `get_reason` | `npm run check` builds the Vite app | Live Vercel URL verified; browser-wallet write evidence remains pending |

## Honest Limits

The active Studionet lifecycle is script-signed with authorized local wallets. The frontend is deployed and wired to the contract, but browser-wallet write evidence has not been captured and is not claimed as complete Project-grade evidence.
