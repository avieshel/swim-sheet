// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mockSettingsApi = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  resetSettings: vi.fn(),
  getEquipmentOptions: vi.fn(),
  setEquipmentOptions: vi.fn(),
  estimateDbSize: vi.fn(),
  cleanupOldData: vi.fn(),
  exportDatabase: vi.fn(),
  importDatabase: vi.fn(),
  getBackupInfo: vi.fn(() => null),
  getStoragePersistence: vi.fn(),
  requestStoragePersistence: vi.fn(),
  deleteAllSwimmers: vi.fn(),
  deleteAllSessions: vi.fn(),
  DEFAULT_EQUIPMENT: ['kickboard', 'pull buoy'],
}))

const mockAuth = vi.hoisted(() => ({
  restoreSession: vi.fn(),
  onAuthChange: vi.fn(() => vi.fn()),
  signInWithGoogle: vi.fn(),
  signInAsTestUser: vi.fn(),
  signOut: vi.fn(),
  canUseTestLogin: vi.fn(() => false),
  setPersistEnabled: vi.fn(),
  isPersistEnabled: vi.fn(() => true),
}))

const mockAnalytics = vi.hoisted(() => {
  const track = vi.fn()
  return {
    analytics: { track },
    Events: {
      AppSettings: vi.fn((action: string, extra?: Record<string, unknown>) => ({
        name: 'app_settings',
        properties: { action, ...(extra ?? {}) },
      })),
    },
  }
})

vi.mock('../../api/settings', () => ({
  getSettings: mockSettingsApi.getSettings,
  updateSettings: mockSettingsApi.updateSettings,
  resetSettings: mockSettingsApi.resetSettings,
  getEquipmentOptions: mockSettingsApi.getEquipmentOptions,
  setEquipmentOptions: mockSettingsApi.setEquipmentOptions,
  estimateDbSize: mockSettingsApi.estimateDbSize,
  cleanupOldData: mockSettingsApi.cleanupOldData,
  exportDatabase: mockSettingsApi.exportDatabase,
  importDatabase: mockSettingsApi.importDatabase,
  getBackupInfo: mockSettingsApi.getBackupInfo,
  getStoragePersistence: mockSettingsApi.getStoragePersistence,
  requestStoragePersistence: mockSettingsApi.requestStoragePersistence,
  deleteAllSwimmers: mockSettingsApi.deleteAllSwimmers,
  deleteAllSessions: mockSettingsApi.deleteAllSessions,
  DEFAULT_EQUIPMENT: mockSettingsApi.DEFAULT_EQUIPMENT,
}))

vi.mock('../../api/auth', () => mockAuth)
vi.mock('../../api/authStorage', () => ({
  setPersistEnabled: mockAuth.setPersistEnabled,
  isPersistEnabled: mockAuth.isPersistEnabled,
}))

vi.mock('../../services/analyticsEvents', () => mockAnalytics)

import { Settings } from '../Settings'
import { AuthProvider } from '../../context/AuthProvider'

function renderSettings() {
  return render(<MemoryRouter><AuthProvider><Settings /></AuthProvider></MemoryRouter>)
}

function lastTrackedEvent(): { name: string; properties: Record<string, unknown> } | undefined {
  const calls = mockAnalytics.analytics.track.mock.calls
  return calls[calls.length - 1]?.[0]
}

describe('Settings analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.restoreSession.mockResolvedValue(null)
    mockAuth.onAuthChange.mockReturnValue(vi.fn())
    mockSettingsApi.getSettings.mockResolvedValue({
      team_name: '',
      coach_name: '',
      team_names: [],
      pool_length: 25,
      distance_units: 'meters',
      notification_enabled: true,
      sync_interval: 30000,
      theme: 'auto',
      font_size: 'medium',
      auto_save: true,
      data_retention_days: 90,
    })
    mockSettingsApi.getEquipmentOptions.mockResolvedValue(['kickboard', 'pull buoy'])
    mockSettingsApi.estimateDbSize.mockResolvedValue({ bytes: 0, tables: {} })
    mockSettingsApi.getStoragePersistence.mockResolvedValue(false)
    mockSettingsApi.cleanupOldData.mockResolvedValue(3)
    mockSettingsApi.requestStoragePersistence.mockResolvedValue(true)
    mockSettingsApi.deleteAllSwimmers.mockResolvedValue(undefined)
    mockSettingsApi.deleteAllSessions.mockResolvedValue(undefined)
    mockAnalytics.analytics.track.mockClear()
  })

  afterEach(() => cleanup())

  it('tracks set_equipment with the full item list after clicking reset', async () => {
    renderSettings()
    await screen.findByText('Reset to defaults')
    fireEvent.click(screen.getByText('Reset to defaults'))
    expect(lastTrackedEvent()).toEqual({
      name: 'app_settings',
      properties: {
        action: 'set_equipment',
        items: ['kickboard', 'pull buoy'],
      },
    })
  })

  it('tracks cleanup_run with the deleted count after a successful cleanup', async () => {
    renderSettings()
    await screen.findByRole('button', { name: 'Clean' })
    fireEvent.click(screen.getByRole('button', { name: 'Clean' }))
    await waitFor(() =>
      expect(lastTrackedEvent()).toEqual({
        name: 'app_settings',
        properties: { action: 'cleanup_run', deleted: 3 },
      })
    )
  })

  it('tracks request_persist with the granted flag', async () => {
    renderSettings()
    await screen.findByRole('button', { name: 'Request protection' })
    fireEvent.click(screen.getByRole('button', { name: 'Request protection' }))
    await waitFor(() =>
      expect(lastTrackedEvent()).toEqual({
        name: 'app_settings',
        properties: { action: 'request_persist', granted: true },
      })
    )
  })

  it('tracks set_pool_length when the 50m button is clicked', async () => {
    renderSettings()
    await screen.findByRole('button', { name: '50m' })
    fireEvent.click(screen.getByRole('button', { name: '50m' }))
    expect(lastTrackedEvent()).toEqual({
      name: 'app_settings',
      properties: { action: 'set_pool_length', pool_length: 50 },
    })
  })

  it('tracks clear_data after confirming the reset-data dialog', async () => {
    renderSettings()
    fireEvent.click(await screen.findByRole('button', { name: 'Reset Data' }))
    await screen.findByText('Delete all swimmers')
    const optionLabel = screen.getByText('Delete all swimmers').closest('label')
    fireEvent.click(optionLabel!)
    fireEvent.click(await screen.findByRole('button', { name: /Reset 1 Item/i }))
    await waitFor(() =>
      expect(mockAnalytics.analytics.track).toHaveBeenCalledWith({
        name: 'app_settings',
        properties: { action: 'clear_data' },
      })
    )
  })

  it('does not track cleanup_run when cleanup fails', async () => {
    mockSettingsApi.cleanupOldData.mockRejectedValue(new Error('storage full'))
    renderSettings()
    await screen.findByRole('button', { name: 'Clean' })
    fireEvent.click(screen.getByRole('button', { name: 'Clean' }))
    await waitFor(() =>
      expect(screen.getByText(/Cleanup failed:/)).toBeTruthy()
    )
    const actions = mockAnalytics.analytics.track.mock.calls.map(([event]) => event.properties.action)
    expect(actions).not.toContain('cleanup_run')
  })
})