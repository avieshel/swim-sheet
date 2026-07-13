import { describe, it, expect } from 'vitest'
import { createTimestampStore, K, effectiveStart, effectiveDone } from '../timestampStore'

describe('TimestampStore', () => {
  it('get/set basic values', () => {
    const store = createTimestampStore()
    expect(store.get('nonexistent')).toBeUndefined()
    store.set('key', 1000)
    expect(store.get('key')).toBe(1000)
    store.set('key', 2000)
    expect(store.get('key')).toBe(2000)
  })

  it('increments version on set', () => {
    const store = createTimestampStore()
    const v0 = store.version
    store.set('key', 1000)
    expect(store.version).toBe(v0 + 1)
  })

  it('batchStop sets group-done for all swimmers', () => {
    const store = createTimestampStore()
    store.batchStop('run1', 'g1', 'drill1', ['s1', 's2', 's3'], 50000)
    expect(store.get(K.swimmerGroupDone('run1', 'g1', 'drill1', 's1'))).toBe(50000)
    expect(store.get(K.swimmerGroupDone('run1', 'g1', 'drill1', 's2'))).toBe(50000)
    expect(store.get(K.swimmerGroupDone('run1', 'g1', 'drill1', 's3'))).toBe(50000)
  })

  it('batchStop does not overwrite existing group-done timestamps', () => {
    const store = createTimestampStore()
    store.set(K.swimmerGroupDone('run1', 'g1', 'drill1', 's1'), 45000)
    store.batchStop('run1', 'g1', 'drill1', ['s1', 's2'], 50000)
    expect(store.get(K.swimmerGroupDone('run1', 'g1', 'drill1', 's1'))).toBe(45000)
    expect(store.get(K.swimmerGroupDone('run1', 'g1', 'drill1', 's2'))).toBe(50000)
  })

  it('batchStop increments version once', () => {
    const store = createTimestampStore()
    const v0 = store.version
    store.batchStop('run1', 'g1', 'drill1', ['s1', 's2'], 50000)
    expect(store.version).toBe(v0 + 1)
  })

  it('clearDrill removes all keys for that drill in a group', () => {
    const store = createTimestampStore()
    store.set(K.swimmerGroupStart('run1', 'g1', 'drill1', 's1'), 0)
    store.set(K.swimmerStart('run1', 'g1', 'drill1', 's1'), 100)
    store.set(K.swimmerGroupDone('run1', 'g1', 'drill1', 's1'), 50000)
    store.set(K.swimmerDone('run1', 'g1', 'drill1', 's1'), 48000)
    store.set(K.swimmerLap('run1', 'g1', 'drill1', 's1', 1), 25000)
    store.set(K.swimmerGroupStart('run1', 'g1', 'drill1', 's2'), 0)
    store.set(K.swimmerGroupDone('run1', 'g1', 'drill1', 's2'), 48000)
    // Same drill in different group — untouched
    store.set(K.swimmerGroupStart('run1', 'g2', 'drill1', 's1'), 0)
    // Different drill in same group — untouched
    store.set(K.swimmerGroupStart('run1', 'g1', 'drill2', 's1'), 100)

    store.clearDrill('run1', 'g1', 'drill1')

    expect(store.get(K.swimmerGroupStart('run1', 'g1', 'drill1', 's1'))).toBeUndefined()
    expect(store.get(K.swimmerStart('run1', 'g1', 'drill1', 's1'))).toBeUndefined()
    expect(store.get(K.swimmerGroupDone('run1', 'g1', 'drill1', 's1'))).toBeUndefined()
    expect(store.get(K.swimmerDone('run1', 'g1', 'drill1', 's1'))).toBeUndefined()
    expect(store.get(K.swimmerLap('run1', 'g1', 'drill1', 's1', 1))).toBeUndefined()
    expect(store.get(K.swimmerGroupStart('run1', 'g1', 'drill1', 's2'))).toBeUndefined()
    expect(store.get(K.swimmerGroupDone('run1', 'g1', 'drill1', 's2'))).toBeUndefined()
    // Other group untouched
    expect(store.get(K.swimmerGroupStart('run1', 'g2', 'drill1', 's1'))).toBe(0)
    // Other drill untouched
    expect(store.get(K.swimmerGroupStart('run1', 'g1', 'drill2', 's1'))).toBe(100)
  })

  it('clearSwimmer removes keys for a specific swimmer', () => {
    const store = createTimestampStore()
    store.set(K.swimmerGroupStart('run1', 'g1', 'drill1', 's1'), 0)
    store.set(K.swimmerStart('run1', 'g1', 'drill1', 's1'), 100)
    store.set(K.swimmerDone('run1', 'g1', 'drill1', 's1'), 50000)
    store.set(K.swimmerLap('run1', 'g1', 'drill1', 's1', 1), 25000)
    store.set(K.swimmerGroupStart('run1', 'g1', 'drill1', 's2'), 0)
    store.set(K.swimmerGroupStart('run1', 'g1', 'drill2', 's1'), 100)

    store.clearSwimmer('run1', 'g1', 'drill1', 's1')

    expect(store.get(K.swimmerGroupStart('run1', 'g1', 'drill1', 's1'))).toBeUndefined()
    expect(store.get(K.swimmerStart('run1', 'g1', 'drill1', 's1'))).toBeUndefined()
    expect(store.get(K.swimmerDone('run1', 'g1', 'drill1', 's1'))).toBeUndefined()
    expect(store.get(K.swimmerLap('run1', 'g1', 'drill1', 's1', 1))).toBeUndefined()
    // Other swimmer in same drill untouched
    expect(store.get(K.swimmerGroupStart('run1', 'g1', 'drill1', 's2'))).toBe(0)
    // Other drill for same swimmer untouched
    expect(store.get(K.swimmerGroupStart('run1', 'g1', 'drill2', 's1'))).toBe(100)
  })

  it('clearGroup removes all keys for that group', () => {
    const store = createTimestampStore()
    store.set(K.swimmerGroupStart('run1', 'g1', 'drill1', 's1'), 0)
    store.set(K.swimmerDone('run1', 'g1', 'drill1', 's1'), 50000)
    store.set(K.swimmerGroupStart('run1', 'g1', 'drill2', 's1'), 100)
    store.set(K.swimmerGroupStart('run1', 'g2', 'drill1', 's1'), 200)

    store.clearGroup('run1', 'g1')

    expect(store.get(K.swimmerGroupStart('run1', 'g1', 'drill1', 's1'))).toBeUndefined()
    expect(store.get(K.swimmerDone('run1', 'g1', 'drill1', 's1'))).toBeUndefined()
    expect(store.get(K.swimmerGroupStart('run1', 'g1', 'drill2', 's1'))).toBeUndefined()
    // Other group untouched
    expect(store.get(K.swimmerGroupStart('run1', 'g2', 'drill1', 's1'))).toBe(200)
  })
})

describe('effectiveStart / effectiveDone', () => {
  it('individual start beats group-start', () => {
    const store = createTimestampStore()
    store.set(K.swimmerGroupStart('r1', 'g1', 'd1', 's1'), 1000)
    store.set(K.swimmerStart('r1', 'g1', 'd1', 's1'), 2000)
    expect(effectiveStart(store, 'r1', 'g1', 's1', 'd1')).toBe(2000)
  })

  it('falls back to group-start', () => {
    const store = createTimestampStore()
    store.set(K.swimmerGroupStart('r1', 'g1', 'd1', 's1'), 1000)
    expect(effectiveStart(store, 'r1', 'g1', 's1', 'd1')).toBe(1000)
  })

  it('returns undefined when neither start set', () => {
    const store = createTimestampStore()
    expect(effectiveStart(store, 'r1', 'g1', 's1', 'd1')).toBeUndefined()
  })

  it('individual done beats group-done', () => {
    const store = createTimestampStore()
    store.set(K.swimmerGroupDone('r1', 'g1', 'd1', 's1'), 50000)
    store.set(K.swimmerDone('r1', 'g1', 'd1', 's1'), 48000)
    expect(effectiveDone(store, 'r1', 'g1', 's1', 'd1')).toBe(48000)
  })

  it('falls back to group-done', () => {
    const store = createTimestampStore()
    store.set(K.swimmerGroupDone('r1', 'g1', 'd1', 's1'), 50000)
    expect(effectiveDone(store, 'r1', 'g1', 's1', 'd1')).toBe(50000)
  })

  it('returns undefined when neither done set', () => {
    const store = createTimestampStore()
    expect(effectiveDone(store, 'r1', 'g1', 's1', 'd1')).toBeUndefined()
  })
})

describe('Key helpers', () => {
  it('generates correct key patterns', () => {
    expect(K.swimmerGroupStart('r1', 'g1', 'd1', 's1'))
      .toBe('session::r1::group::g1::drill::d1::swimmer::s1::group-start')
    expect(K.swimmerGroupDone('r1', 'g1', 'd1', 's1'))
      .toBe('session::r1::group::g1::drill::d1::swimmer::s1::group-done')
    expect(K.swimmerStart('r1', 'g1', 'd1', 's1'))
      .toBe('session::r1::group::g1::drill::d1::swimmer::s1::start')
    expect(K.swimmerDone('r1', 'g1', 'd1', 's1'))
      .toBe('session::r1::group::g1::drill::d1::swimmer::s1::done')
    expect(K.swimmerLap('r1', 'g1', 'd1', 's1', 3))
      .toBe('session::r1::group::g1::drill::d1::swimmer::s1::lap::3')
  })
})
