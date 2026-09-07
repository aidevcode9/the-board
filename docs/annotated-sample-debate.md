# Annotated sample debate: stale equipment status

> **Fictional walkthrough.** This is a deliberately seeded training example, not a recorded model run, operational advice, or a benchmark. It uses no live provider calls and shows no model-reported scores.

## Decision to examine

At a distribution center, the operations console shows that autonomous cart **A-17** is available. Its last telemetry heartbeat is 42 minutes old, while the normal heartbeat interval is 60 seconds. A supervisor asks whether the cart can be assigned to a pick run that will pass near people and pallet jacks.

The right answer is not a confident guess about the cart. It is a safe, auditable decision under incomplete evidence.

## Independent proposals

### Response A — protect people first

Treat A-17 as unavailable until its location, battery, emergency-stop state, and current fault code are verified through an approved read-only source. Do not issue a movement, reset, or route command from the workbench. The supervisor should reroute the pick run to a known-good cart or use the manual process.

**Why it matters:** a stale “available” label cannot establish that the cart is stationary, safe, or controllable.

### Response B — restore observability before assignment

Ask the equipment owner to investigate the telemetry gap and to reconcile the console with the fleet controller. Record the 42-minute freshness breach, preserve the current log window, and assign the job only after an authorized operator has confirmed the cart’s state.

**Why it matters:** immediately overwriting the status could erase the evidence needed to diagnose why monitoring failed.

### Response C — keep the operation moving with guardrails

Select another verified cart if capacity permits. If no alternative exists, pause this pick segment and escalate to the shift lead. The escalation should state the business impact, the unknown equipment state, and the exact evidence required to resume.

**Why it matters:** urgency should change the escalation path, not lower the evidence threshold for moving equipment near people.

## Anonymized cross-review

The critique phase refers to proposals by response label, never model identity.

| Review | What it challenges | What it retains |
|---|---|---|
| Response A critiques Response C | A pause alone does not say who must verify the cart or which system is authoritative. | The alternate-cart path protects throughput without assuming A-17 is safe. |
| Response B critiques Response A | “Verify state” is too broad unless it names the minimum facts: location, stop state, battery, and fault code. | The proposal correctly prevents a command from being sent based on stale telemetry. |
| Response C critiques Response B | An investigation can become open-ended while a pick run is blocked. The operational fallback needs an owner and a decision time. | Preserving the telemetry gap is necessary for follow-up and avoids hiding the failure. |

## Revised synthesis

1. Mark A-17 **unavailable pending verification** in the operations workflow. This is a human or approved-system action; the workbench only frames the decision.
2. Assign a known-good alternative cart. If none is available, pause the affected segment and escalate to the shift lead.
3. Ask the equipment owner to verify A-17 through the fleet controller and report four facts: location, emergency-stop state, battery, and active fault code.
4. Preserve the stale-heartbeat record and open an observability follow-up. Do not reset the cart, clear faults, or alter telemetry history to make the dashboard look current.
5. The shift lead decides whether to resume only after the approved verification is complete. The workbench does not authorize equipment movement.

## What remains unresolved

- Whether the 60-second heartbeat objective should page before a cart appears available.
- Which team owns reconciliation between the operations console and the fleet controller.
- Whether the alternate-cart capacity policy needs a documented maximum delay.

These are intentionally left open. A useful debate makes uncertainty visible instead of converting it into a synthetic consensus.

## How this maps to the workbench

| Workbench stage | Illustrated here |
|---|---|
| Independent response | Three distinct approaches: safety boundary, observability, and operational continuity. |
| Anonymized review | Responses challenge specific omissions without revealing model identity. |
| Synthesis | The combined procedure states evidence, owner, and escalation path. |
| Human authority | The shift lead retains the decision to resume work. |

For the actual implementation, see the [architecture overview](../ARCHITECTURE.md) and [portfolio plan](../features/active/portfolio-credibility/03_IMPLEMENTATION_PLAN.md). A static, sanitized replay is a separate future slice and must not call live paid model APIs.
