# Distributed Systems — Interview Prep Knowledge

> Auto-updated from high-quality debates. Last update: 2026-02-25

---

## Overview

Distributed systems interviews test deep understanding of consensus, replication, fault tolerance, and the fundamental impossibility results that constrain system design. Interviewers look for candidates who can reason about failure modes and trade-offs rather than recite textbook definitions.

---

## Core Concepts

### Consensus Algorithms
- **Definition:** Protocols that allow distributed nodes to agree on a single value despite failures (Raft, Paxos, PBFT).
- **Interview relevance:** Consensus is the foundation of replicated state machines, leader election, and distributed transactions.
- **Common misconception:** "Raft and Paxos solve the same problem identically" — Raft optimizes for understandability and has a stricter leader model; Paxos is more flexible but harder to implement correctly.

### Byzantine Fault Tolerance
- **Definition:** The ability of a system to function correctly even when some nodes behave arbitrarily (maliciously or due to bugs).
- **Interview relevance:** Distinguishes candidates who understand trust boundaries in distributed systems.
- **Common misconception:** "BFT is only for blockchain" — any system with untrusted components (multi-tenant, edge computing) benefits from Byzantine fault tolerance reasoning.

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
