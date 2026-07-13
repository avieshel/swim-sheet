import { Router } from 'express'
import type { Database } from 'better-sqlite3'
import { randomUUID } from 'crypto'

export function createSwimmersRouter(db: Database): Router {
  const router = Router()

  router.get('/', (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 50, 200)
        const offset = Number(req.query.offset) || 0
        const nameFilter = req.query.name ? `%${String(req.query.name).toLowerCase()}%` : null
        const groupFilter = req.query.group_name ? `%${String(req.query.group_name).toLowerCase()}%` : null
        
        let where = '1=1'
        const params: unknown[] = []
        if (nameFilter) {
          where += ' AND LOWER(name) LIKE ?'
          params.push(nameFilter)
        }
        if (groupFilter) {
          where += ' AND LOWER(group_name) LIKE ?'
          params.push(groupFilter)
        }
        
        const swimmers = db.prepare(`SELECT * FROM swimmers WHERE ${where} ORDER BY name LIMIT ? OFFSET ?`).all(...params, limit, offset)
      res.json(swimmers)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.get('/:id', (req, res) => {
    try {
      const swimmer = db.prepare('SELECT * FROM swimmers WHERE id = ?').get(req.params.id)
      if (!swimmer) return res.status(404).json({ error: 'Swimmer not found' })
      res.json(swimmer)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.post('/', (req, res) => {
    try {
      const { name, group_name, notes, status } = req.body
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Validation failed', details: { name: 'required' } })
      }
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare('INSERT INTO swimmers (id, name, group_name, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, name.trim(), group_name?.trim() || null, notes?.trim() || null, status || 'active', now, now)
      const swimmer = db.prepare('SELECT * FROM swimmers WHERE id = ?').get(id)
      res.status(201).json(swimmer)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.put('/:id', (req, res) => {
    try {
      const { name, group_name, notes, status } = req.body
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Validation failed', details: { name: 'required' } })
      }
      const now = new Date().toISOString()
      const info = db.prepare('UPDATE swimmers SET name=?, group_name=?, notes=?, status=?, updated_at=? WHERE id=?')
        .run(name.trim(), group_name?.trim() || null, notes?.trim() || null, status || 'active', now, req.params.id)
      if (info.changes === 0) return res.status(404).json({ error: 'Swimmer not found' })
      const swimmer = db.prepare('SELECT * FROM swimmers WHERE id = ?').get(req.params.id)
      res.json(swimmer)
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  router.delete('/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM laps WHERE session_id IN (SELECT id FROM sessions WHERE swimmer_id = ?)').run(req.params.id)
      db.prepare('DELETE FROM sessions WHERE swimmer_id = ?').run(req.params.id)
      const info = db.prepare('DELETE FROM swimmers WHERE id = ?').run(req.params.id)
      if (info.changes === 0) return res.status(404).json({ error: 'Swimmer not found' })
      res.json({ message: 'Swimmer deleted' })
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  return router
}