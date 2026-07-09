import { Router } from 'express'
import type { Database } from 'better-sqlite3'
import { randomUUID } from 'crypto'

export function createLapsRouter(db: Database): Router {
  const router = Router()

  router.get('/', (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200)
      const offset = Number(req.query.offset) || 0
      const sessionId = req.query.session_id as string | undefined

      let where = '1=1'
      const params: unknown[] = []

      if (sessionId) {
        where += ' AND laps.session_id = ?'
        params.push(sessionId)
      }

      params.push(limit, offset)

      const laps = db.prepare(`
        SELECT * FROM laps
        WHERE ${where}
        ORDER BY id
        LIMIT ? OFFSET ?
      `).all(...params)
      res.json(laps)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.get('/:id', (req, res) => {
    try {
      const lap = db.prepare('SELECT * FROM laps WHERE id = ?').get(req.params.id)
      if (!lap) return res.status(404).json({ error: 'Lap not found' })
      res.json(lap)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.post('/', (req, res) => {
    try {
      const { session_id, stroke, distance, time, stroke_count, effort, notes } = req.body
      if (!session_id || !stroke || distance === undefined || time === undefined || stroke_count === undefined) {
        return res.status(400).json({ error: 'Validation failed', details: { session_id: 'required', stroke: 'required', distance: 'required', time: 'required', stroke_count: 'required' } })
      }
      const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(session_id)
      if (!session) {
        return res.status(400).json({ error: 'Validation failed', details: { session_id: 'not found' } })
      }
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare('INSERT INTO laps (id, session_id, stroke, distance, time, stroke_count, effort, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, session_id, stroke, distance, time, stroke_count, effort?.trim() || null, notes?.trim() || null, now, now)
      const lap = db.prepare('SELECT * FROM laps WHERE id = ?').get(id)
      res.status(201).json(lap)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.put('/:id', (req, res) => {
    try {
      const { session_id, stroke, distance, time, stroke_count, effort, notes } = req.body
      if (!session_id || !stroke || distance === undefined || time === undefined || stroke_count === undefined) {
        return res.status(400).json({ error: 'Validation failed', details: { session_id: 'required', stroke: 'required', distance: 'required', time: 'required', stroke_count: 'required' } })
      }
      const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(session_id)
      if (!session) {
        return res.status(400).json({ error: 'Validation failed', details: { session_id: 'not found' } })
      }
      const now = new Date().toISOString()
      const info = db.prepare('UPDATE laps SET session_id=?, stroke=?, distance=?, time=?, stroke_count=?, effort=?, notes=?, updated_at=? WHERE id=?')
        .run(session_id, stroke, distance, time, stroke_count, effort?.trim() || null, notes?.trim() || null, now, req.params.id)
      if (info.changes === 0) return res.status(404).json({ error: 'Lap not found' })
      const lap = db.prepare('SELECT * FROM laps WHERE id = ?').get(req.params.id)
      res.json(lap)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.delete('/:id', (req, res) => {
    try {
      const info = db.prepare('DELETE FROM laps WHERE id = ?').run(req.params.id)
      if (info.changes === 0) return res.status(404).json({ error: 'Lap not found' })
      res.json({ message: 'Lap deleted' })
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  return router
}