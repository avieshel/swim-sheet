import { Router } from 'express'
import { createSettingsDAO } from '../db/schema'

export function createSettingsRoutes(settingsDAO: ReturnType<typeof createSettingsDAO>) {
  const router = Router()

  router.get('/', (req, res) => {
    try {
      const settings = settingsDAO.getAll()
      res.json(settings)
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch settings' })
    }
  })

  router.post('/', (req, res) => {
    try {
      const settings = settingsDAO.create(req.body)
      res.json(settings)
    } catch (error) {
      res.status(500).json({ error: 'Failed to create settings' })
    }
  })

  router.patch('/:id', (req, res) => {
    try {
      const { id } = req.params
      const settings = settingsDAO.update(id, req.body)
      res.json(settings)
    } catch (error) {
      if (error instanceof Error && error.message === 'Settings not found') {
        return res.status(404).json({ error: 'Settings not found' })
      }
      res.status(500).json({ error: 'Failed to update settings' })
    }
  })

  router.delete('/:id', (req, res) => {
    try {
      const { id } = req.params
      settingsDAO.delete(id)
      res.status(204).send()
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete settings' })
    }
  })

  router.post('/reset', (req, res) => {
    try {
      const settings = settingsDAO.resetToDefaults()
      res.json(settings)
    } catch (error) {
      res.status(500).json({ error: 'Failed to reset settings' })
    }
  })

  return router
}