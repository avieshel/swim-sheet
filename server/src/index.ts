import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { initDb } from './db/schema'
import { createSwimmersRouter } from './routes/swimmers'
import { createSessionsRouter } from './routes/sessions'
import { createLapsRouter } from './routes/laps'

const app = express()
const port = process.env.PORT || 3001

if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data')
}

const db = new Database('./data/data.db')
db.pragma('journal_mode = WAL')
initDb(db)

app.use(cors({ origin: '*' }))
app.use(express.json())

// API v1 routes
app.use('/api/v1/swimmers', createSwimmersRouter(db))
app.use('/api/v1/sessions', createSessionsRouter(db))
app.use('/api/v1/laps', createLapsRouter(db))

// Serve static files from the client build
const publicPath = path.join(__dirname, '..', 'public')
app.use(express.static(publicPath))

// Fallback to index.html for client-side routing (non-API requests)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(publicPath, 'index.html'))
  } else {
    // If API route not found, let express handle 404
    res.status(404).json({ error: 'Not Found' })
  }
})

app.listen(port, () => {
  console.log(`SwimSheet server running on port ${port}`)
})

export { db }