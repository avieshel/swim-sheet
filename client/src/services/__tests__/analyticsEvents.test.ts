import { describe, expect, it } from 'vitest'
import { Events } from '../analyticsEvents'

describe('account lifecycle events', () => {
  it('SignedIn carries method enum', () => {
    expect(Events.SignedIn('email')).toEqual({
      name: 'signed_in',
      properties: { method: 'email' },
    })
  })

  it('SignedOut has no properties', () => {
    expect(Events.SignedOut()).toEqual({ name: 'signed_out' })
  })
})

describe('app engagement events', () => {
  it('AppBackgrounded carries non-negative foreground_ms', () => {
    expect(Events.AppBackgrounded(1234)).toEqual({
      name: 'app_backgrounded',
      properties: { foreground_ms: 1234 },
    })
    expect(Events.AppBackgrounded(-5)).toEqual({
      name: 'app_backgrounded',
      properties: { foreground_ms: 0 },
    })
  })

  it('AppForegrounded carries last_background_ms or null', () => {
    expect(Events.AppForegrounded(5000)).toEqual({
      name: 'app_foregrounded',
      properties: { last_background_ms: 5000 },
    })
    expect(Events.AppForegrounded(null)).toEqual({
      name: 'app_foregrounded',
      properties: { last_background_ms: null },
    })
  })
})

describe('search event', () => {
  it('SearchPerformed carries scope enum and result_count', () => {
    expect(Events.SearchPerformed('swimmers', 12)).toEqual({
      name: 'search_performed',
      properties: { scope: 'swimmers', result_count: 12 },
    })
  })
})

describe('sharing and failure events', () => {
  it('SessionPackageShared carries drill_count and source', () => {
    expect(Events.SessionPackageShared(8, 'template')).toEqual({
      name: 'session_package_shared',
      properties: { drill_count: 8, source: 'template' },
    })
  })

  it('SessionPackageImported carries drill_count and source', () => {
    expect(Events.SessionPackageImported(8, 'share_link')).toEqual({
      name: 'session_package_imported',
      properties: { drill_count: 8, source: 'share_link' },
    })
  })

  it('ShareFailed carries error_kind', () => {
    expect(Events.ShareFailed('network')).toEqual({
      name: 'share_failed',
      properties: { error_kind: 'network' },
    })
  })

  it('PackageImportFailed carries error_kind and source', () => {
    expect(Events.PackageImportFailed('network', 'file')).toEqual({
      name: 'package_import_failed',
      properties: { error_kind: 'network', source: 'file' },
    })
  })

  it('BackupFailed carries error_kind', () => {
    expect(Events.BackupFailed('quota')).toEqual({
      name: 'backup_failed',
      properties: { error_kind: 'quota' },
    })
  })

  it('SessionOpenedViaShare has no properties', () => {
    expect(Events.SessionOpenedViaShare()).toEqual({ name: 'session_opened_via_share' })
  })
})

describe('ai draft events', () => {
  it('AiDraftGenerated carries drill_count, total_distance, source', () => {
    expect(Events.AiDraftGenerated(10, 1500, 'harness')).toEqual({
      name: 'ai_draft_generated',
      properties: { drill_count: 10, total_distance: 1500, source: 'harness' },
    })
  })

  it('AiDraftFailed carries error_kind', () => {
    expect(Events.AiDraftFailed('rate_limited')).toEqual({
      name: 'ai_draft_failed',
      properties: { error_kind: 'rate_limited' },
    })
  })

  it('AiDraftRequested carries source', () => {
    expect(Events.AiDraftRequested('harness')).toEqual({
      name: 'ai_draft_requested',
      properties: { source: 'harness' },
    })
  })

  it('AiDraftAccepted carries drill_count', () => {
    expect(Events.AiDraftAccepted(3)).toEqual({
      name: 'ai_draft_accepted',
      properties: { drill_count: 3 },
    })
  })

  it('AiDraftRejected has no properties', () => {
    expect(Events.AiDraftRejected()).toEqual({ name: 'ai_draft_rejected' })
  })
})

describe('live session events', () => {
  it('SessionPaused has no properties', () => {
    expect(Events.SessionPaused()).toEqual({ name: 'session_paused' })
  })

  it('SessionResumed has no properties', () => {
    expect(Events.SessionResumed()).toEqual({ name: 'session_resumed' })
  })
})

describe('screen dwell events', () => {
  it('ViewExited carries screen enum and non-negative dwell_ms', () => {
    expect(Events.ViewExited('dashboard', 4200)).toEqual({
      name: 'view_exited',
      properties: { screen: 'dashboard', dwell_ms: 4200 },
    })
    expect(Events.ViewExited('sessions', -5)).toEqual({
      name: 'view_exited',
      properties: { screen: 'sessions', dwell_ms: 0 },
    })
  })
})
