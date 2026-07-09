import { Router } from 'express'
import type { Database } from 'better-sqlite3'
import { randomUUID } from 'crypto'

export function createSessionsRouter(db: Database): Router {
  const router = Router()

  // ── Session Templates ────────────────────────────────────

  router.get('/', (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200)
      const offset = Number(req.query.offset) || 0

      const rows = db.prepare(`
        SELECT * FROM sessions
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset)
      res.json(rows)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.get('/:id', (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id)
      if (!row) return res.status(404).json({ error: 'Session not found' })
      res.json(row)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.post('/', (req, res) => {
    try {
      const { name, pool_length, notes } = req.body
      if (!name) {
        return res.status(400).json({ error: 'Validation failed', details: { name: 'required' } })
      }
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare('INSERT INTO sessions (id, name, pool_length, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, name.trim(), Number(pool_length) || 25, notes?.trim() || null, now, now)
      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id)
      res.status(201).json(session)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.put('/:id', (req, res) => {
    try {
      const { name, pool_length, notes } = req.body
      const now = new Date().toISOString()
      const fields: string[] = ['updated_at = ?']
      const values: any[] = [now]
      if (name !== undefined) { fields.push('name = ?'); values.push(name.trim()) }
      if (pool_length !== undefined) { fields.push('pool_length = ?'); values.push(Number(pool_length)) }
      if (notes !== undefined) { fields.push('notes = ?'); values.push(notes?.trim() || null) }
      values.push(req.params.id)
      const info = db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values)
      if (info.changes === 0) return res.status(404).json({ error: 'Session not found' })
      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id)
      res.json(session)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.delete('/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM drills WHERE session_id = ?').run(req.params.id)
      const info = db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id)
      if (info.changes === 0) return res.status(404).json({ error: 'Session not found' })
      res.json({ message: 'Session deleted' })
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  // ── Drills ──────────────────────────────────────────────

  router.get('/:id/drills', (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM drills WHERE session_id = ? ORDER BY drill_order ASC').all(req.params.id)
      res.json(rows)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  // ── Session Runs ─────────────────────────────────────────

  router.get('/runs/active', (req, res) => {
    try {
      const row = db.prepare("SELECT * FROM session_runs WHERE status = 'active' LIMIT 1").get()
      if (!row) return res.json(null)
      res.json(row)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.get('/runs', (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM session_runs ORDER BY date DESC').all()
      res.json(rows)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.post('/runs', (req, res) => {
    try {
      const { session_id, date, pool_name, pool_length, notes } = req.body
      if (!session_id || !date) {
        return res.status(400).json({ error: 'Validation failed', details: { session_id: 'required', date: 'required' } })
      }
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare('INSERT INTO session_runs (id, session_id, date, pool_name, pool_length, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, session_id, date, pool_name?.trim() || null, Number(pool_length) || 25, notes?.trim() || null, 'active', now, now)

      // Snapshot drills from template
      const drills = db.prepare('SELECT * FROM drills WHERE session_id = ?').all(session_id) as any[]
      for (const drill of drills) {
        const did = randomUUID()
        db.prepare('INSERT INTO run_drills (id, run_id, name, stroke, distance, drill_order, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(did, id, drill.name, drill.stroke, drill.distance, drill.drill_order, null, now, now)
      }

      const run = db.prepare('SELECT * FROM session_runs WHERE id = ?').get(id)
      res.status(201).json(run)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.put('/runs/:id/complete', (req, res) => {
    try {
      const now = new Date().toISOString()
      const info = db.prepare("UPDATE session_runs SET status = 'completed', updated_at = ? WHERE id = ?").run(now, req.params.id)
      if (info.changes === 0) return res.status(404).json({ error: 'Session run not found' })
      const run = db.prepare('SELECT * FROM session_runs WHERE id = ?').get(req.params.id)
      res.json(run)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  return router
}
