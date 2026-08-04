# Context: Drill Normalization Strategy (Deferred)

## The Problem
We have identified that ad-hoc drill naming in `LiveDeck` (e.g., "Free 50" vs. "50 Freestyle") leads to database fragmentation and redundant drill entries in the `DrillBank`. 

## Proposed Solution (Hybrid Synchronized Model)
Rather than enforcing strict naming at the moment of creation (which increases friction for the **Deck Timer**), we propose a deferred normalization strategy:

1.  **Registry with Aliases:** Extend the `Drill` schema to include a canonical name and a list of recognized aliases.
2.  **JIT Suggestion:** Use lightweight fuzzy matching in the `DrillEditorModal` to suggest canonical names while a coach is planning.
3.  **Background Normalizer:** A periodic background process (the "Normalization Task Worker") that reviews high-frequency ad-hoc names and suggests merging them into canonical entries.

## Decision: Deferred Implementation
We have evaluated the impact vs. effort for this feature.
- **Current Stance:** The problem is recognized but not yet critical.
- **Policy:** **Do not implement** normalization logic or schema changes until we have actual user data or direct feedback indicating that drill fragmentation is hindering session planning or analytics.
- **Trigger:** Re-visit this task only when real-world usage patterns show consistent drift in drill naming.

---
*Status: Pending / Deferred.*
