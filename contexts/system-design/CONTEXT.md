# System Design — Interview Prep Knowledge

> Auto-updated from high-quality debates. Last update: 2026-02-25

---

## Overview

System design interviews test your ability to reason about large-scale systems: scalability, consistency, availability, and trade-offs. The best answers combine theory (CAP theorem, consensus algorithms) with pragmatic implementation knowledge.

---

## Core Concepts

### CAP Theorem
- **Definition:** A distributed system can guarantee at most two of: Consistency, Availability, Partition-tolerance.
- **Interview relevance:** Understanding which trade-off to make shows engineering maturity.
- **Common misconception:** "Just choose CA or CP" — partition tolerance is non-negotiable on real networks.

### Eventual Consistency
- **Definition:** A system that may temporarily show stale data but converges to a consistent state over time.
- **Interview relevance:** Most scalable systems (DynamoDB, Cassandra) rely on eventual consistency.
- **Common misconception:** "Eventually consistent = unreliable" — it is a valid, well-understood trade-off.

---

## Key Disagreements & Resolutions

*(This section grows as debates contribute knowledge.)*

---

## Interview Framings

*(This section grows as high-scoring debates identify effective answer patterns.)*

---

## Common Misconceptions

*(This section grows as debate critiques identify recurring misunderstandings.)*

---

## References

- Contributing debate IDs: *(none yet)*
