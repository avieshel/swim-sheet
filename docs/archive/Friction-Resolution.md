# Context: Friction Mitigation & Agent Alignment

This document tracks the resolution of agent friction identified in the codebase, moving toward a "Hybrid Synchronized Model" that balances the agility of the **Deck Timer** with the structure required by the **Set Architect**.

## Active Friction Resolution Strategy

| Friction Area | Compromise Approach |
| :--- | :--- |
| **Virtual Swimmer Handoff** | Post-session reconciliation via soft-prompting for promotion. |
| **Drill Naming Discrepancies** | Background normalization / fuzzy-matching of ad-hoc drill names. |
| **Sync Concurrency** | Lane-based ownership of writes to prevent collision. |
| **Partial Session Analytics** | Tiered session classification (Completed/Partial/Ad-Hoc). |

---

## Task: Promote Virtual Swimmers to Roster

**Priority:** High (Quick Win)
**Agent Alignment:** Hybrid / Compromise

### Goal
Allow coaches to promote "Virtual Swimmers" (created on-the-fly) to the permanent roster upon completion of a session.

### Implementation Logic
1. **Trigger:** `LiveDeck` completion flow (when clicking "Complete Session").
2. **Detection:** Identify all swimmers in the session without a `dbId` (permanent record link).
3. **UX Pattern:**
   - Add a non-intrusive step in the "Complete Session" modal.
   - List all virtual swimmers.
   - Provide a "Promote to Roster" checkbox for each, or a "Bulk Promote" option.
   - *Constraint:* Do not force promotion. Allow coaches to bypass this permanently for specific sessions or individual swimmers.
   - *Logic:* Use `swimmerService.promoteAndLinkSwimmer()` or equivalent, linking session lap data to the newly created/assigned roster ID.

### UX Guardrails
- **Minimal Intrusion:** The prompt must appear *at the end* of the session, not during timing.
- **Graceful Degradation:** Coaches who prefer ad-hoc timing should be able to ignore/dismiss the prompt with one click.
- **No Data Loss:** If the coach ignores the prompt, the virtual data remains accessible via the historical `SessionRun`.

---

## Roadmap of Todos

- [ ] **(In Progress)** Add post-session virtual swimmer promotion prompt in `LiveDeck` completion flow.
- [ ] Implement `DrillNormalizer` utility to suggest registry matches for ad-hoc drill names.
- [ ] Enhance `LiveSessionContext` to support Lane Ownership flags (preventing cross-device write conflicts).
