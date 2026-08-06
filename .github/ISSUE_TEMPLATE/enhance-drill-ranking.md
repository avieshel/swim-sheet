---
name: Enhance Drill Ranking Algorithm
about: Improve the popularity-based drill ranking with decay, recency, and personalization
title: '[Enhancement] Enhance drill ranking algorithm'
labels: enhancement
assignees: ''
---

## Current State

Drills have a simple `popularity` counter (stored on `LibraryDrill`) that increments when a coach adds a drill to a session or creates/edits a custom drill. The ranking is a flat usage count with no decay, recency, or personalization.

## Proposed Enhancements

### 1. Time Decay
- Older usage should count less than recent usage
- Implement exponential decay: `weight = e^(-λ * days_ago)` where λ controls the decay rate
- Example: a drill used 50 times 2 years ago should rank below one used 30 times this month

### 2. Recency Weighting
- Usage in the last 30 days should carry more weight than older usage
- Consider a sliding window: only count usage from the last N months for ranking

### 3. Personalization
- Each coach should see a ranking tailored to their own usage patterns
- Store per-coach popularity in a separate table or compute it on the fly from session/run data
- Optionally blend global popularity with personal usage: `score = α * global_popularity + (1-α) * personal_usage`

### 4. Engagement Weighting
- Distinguish between "added to session" (low engagement) and "actually timed" (high engagement)
- Weight by swim time or laps completed, not just session inclusion

### 5. Contextual Labels
- Boost drills matching the current coach's preferred labels/stroke/focus
- Allow coaches to pin favorite drills above the ranking

## Technical Notes

- Current `popularity` field is on `LibraryDrill` (schema.ts)
- `bumpDrillPopularity()` in dao.ts is the increment function
- `getPopularDrills()` in dao.ts is the query function
- The `DrillBank` component in `DrillBank.tsx` has a "Popular" sort toggle

## Acceptance Criteria

- [ ] Time decay is implemented and configurable
- [ ] Recency window is configurable
- [ ] Personal popularity is computed per-coach
- [ ] Engagement weighting distinguishes session-add from actual timing
- [ ] Backward compatible with existing `popularity` field
- [ ] UI shows "Popular" sort alongside the new "Recommended" sort