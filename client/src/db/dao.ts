import { db } from './schema'
import type { Swimmer, Session, Drill, SessionRun, RunDrill, RunSwimmer, Lap, LaneDrillResult, LibraryDrill, SafeSwimmer, SafeSession, SafeDrill, SafeSessionRun, SafeRunDrill, SafeLap, SafeLaneDrillResult, SafeLibraryDrill } from './schema'

// ── Swimmers ──────────────────────────────────────────────

export async function getAllSwimmers(): Promise<Swimmer[]> {
  return db.swimmers.orderBy('name').toArray()
}

export async function searchSwimmers(query: string): Promise<Swimmer[]> {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return db.swimmers
    .filter(s => s.name.toLowerCase().includes(q))
    .limit(10)
    .toArray()
}

export async function getSwimmer(id: string): Promise<Swimmer | undefined> {
  return db.swimmers.get(id)
}

export async function addSwimmer(data: SafeSwimmer): Promise<string> {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.swimmers.add({ ...data, status: data.status ?? 'active', id, createdAt: now, updatedAt: now })
  return id
}

export async function updateSwimmer(id: string, data: Partial<SafeSwimmer>): Promise<void> {
  await db.swimmers.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteSwimmer(id: string): Promise<void> {
  await db.swimmers.delete(id)
}

// ── Session Templates ─────────────────────────────────────

export async function getAllSessions(): Promise<Session[]> {
  return db.sessions.orderBy('createdAt').reverse().toArray()
}

export async function getSession(id: string): Promise<Session | undefined> {
  return db.sessions.get(id)
}

export async function addSession(data: SafeSession): Promise<string> {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.sessions.add({ ...data, id, createdAt: now, updatedAt: now })
  return id
}

export async function updateSession(id: string, data: Partial<SafeSession>): Promise<void> {
  await db.sessions.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', [db.sessions, db.drills], async () => {
    await db.drills.where('session_id').equals(id).delete()
    await db.sessions.delete(id)
  })
}

// ── Template Drills ────────────────────────────────────────

export async function getDrillsForSession(sessionId: string): Promise<Drill[]> {
  return db.drills.where('session_id').equals(sessionId).toArray()
}

export async function getDrill(id: string): Promise<Drill | undefined> {
  return db.drills.get(id)
}

export async function updateLibraryDrill(id: string, data: Partial<SafeLibraryDrill>): Promise<void> {
  await db.libraryDrills.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function addDrill(data: SafeDrill): Promise<string> {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const drill: Drill = {
    ...data,
    id,
    items: data.items || [
      {
        id: crypto.randomUUID(),
        distance: data.distance || 0,
        stroke: data.stroke || 'freestyle',
        repeatCount: 1,
      },
    ],
    repeatCount: data.repeatCount || 1,
    timingMode: data.timingMode || 'individual',
    focus: data.focus || 'none',
    labels: data.labels || [],
    description: data.description || '',
    createdAt: now,
    updatedAt: now,
  }
  await db.drills.add(drill)

  // Also save to library
  const libDrill: SafeLibraryDrill = {
    name: drill.name,
    stroke: drill.stroke,
    distance: drill.distance,
    items: drill.items,
    repeatCount: drill.repeatCount,
    timingMode: drill.timingMode,
    focus: drill.focus,
    labels: drill.labels,
    description: drill.description,
  }
  await addLibraryDrill(libDrill)

  return id
}

export async function updateDrill(id: string, data: Partial<SafeDrill>): Promise<void> {
  await db.drills.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteDrill(id: string): Promise<void> {
  await db.drills.delete(id)
}

// ── Session Runs ──────────────────────────────────────────

export async function getActiveRun(): Promise<SessionRun | undefined> {
  return db.sessionRuns.where('status').equals('active').first()
}

export async function getSessionRun(id: string): Promise<SessionRun | undefined> {
  return db.sessionRuns.get(id)
}

export async function getAllSessionRuns(): Promise<SessionRun[]> {
  return db.sessionRuns.orderBy('date').reverse().toArray()
}

export async function getCompletedRuns(): Promise<SessionRun[]> {
  const runs = await db.sessionRuns.where('status').equals('completed').toArray()
  return runs.sort((a, b) => b.date.localeCompare(a.date))
}

export async function getRunsForSession(sessionId: string): Promise<SessionRun[]> {
  return db.sessionRuns.where('session_id').equals(sessionId).toArray()
}

export async function addSessionRun(data: SafeSessionRun): Promise<string> {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  // Only one active run allowed — auto-complete any existing active run
  if (data.status === 'active') {
    const existing = await getActiveRun()
    if (existing) {
      await completeSessionRun(existing.id!)
    }
  }

  await db.sessionRuns.add({ ...data, id, createdAt: now, updatedAt: now })
  return id
}

export async function updateSessionRun(id: string, data: Partial<SafeSessionRun>): Promise<void> {
  await db.sessionRuns.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function completeSessionRun(id: string): Promise<void> {
  await db.sessionRuns.update(id, { status: 'completed', updatedAt: new Date().toISOString() })
}

// ── Run Drills (snapshots) ────────────────────────────────

export async function getRunDrillsForRun(runId: string): Promise<RunDrill[]> {
  return db.runDrills.where('run_id').equals(runId).toArray()
}

export async function getRunDrill(id: string): Promise<RunDrill | undefined> {
  return db.runDrills.get(id)
}

export async function addRunDrill(data: SafeRunDrill): Promise<string> {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.runDrills.add({ ...data, id, createdAt: now, updatedAt: now })
  return id
}

export async function deleteRunDrill(id: string): Promise<void> {
  await db.transaction('rw', [db.runDrills, db.laps], async () => {
    await db.laps.where('run_drill_id').equals(id).delete()
    await db.runDrills.delete(id)
  })
}

export async function updateRunDrill(id: string, data: Partial<SafeRunDrill>): Promise<void> {
  await db.runDrills.update(id, { ...data, updatedAt: new Date().toISOString() })
}

// ── Lane Drill Results (per-group per-drill completion) ─────

export async function getLaneDrillResults(runId: string): Promise<LaneDrillResult[]> {
  return db.laneDrillResults.where('run_id').equals(runId).toArray()
}

export async function getLaneDrillResult(runId: string, groupId: string, runDrillId: string): Promise<LaneDrillResult | undefined> {
  return db.laneDrillResults.where({ run_id: runId, group_id: groupId, run_drill_id: runDrillId }).first()
}

export async function setLaneDrillResult(data: SafeLaneDrillResult): Promise<string> {
  const existing = await db.laneDrillResults.where({ run_id: data.run_id, group_id: data.group_id, run_drill_id: data.run_drill_id }).first()
  const now = new Date().toISOString()
  if (existing) {
    await db.laneDrillResults.update(existing.id!, { ...data, updatedAt: now })
    return existing.id!
  } else {
    const id = crypto.randomUUID()
    await db.laneDrillResults.add({ ...data, id, updatedAt: now })
    return id
  }
}

export async function deleteLaneDrillResult(id: string): Promise<void> {
  await db.laneDrillResults.delete(id)
}

export async function deleteLaneDrillResultsForGroup(runId: string, groupId: string): Promise<void> {
  await db.laneDrillResults.where({ run_id: runId, group_id: groupId }).delete()
}

export async function deleteLaneDrillResultsForRun(runId: string): Promise<void> {
  await db.laneDrillResults.where('run_id').equals(runId).delete()
}

export async function clearSwimmerFromLaneDrillResult(runId: string, groupId: string, runDrillId: string, swimmerDbId: string): Promise<void> {
  const result = await db.laneDrillResults.where({ run_id: runId, group_id: groupId, run_drill_id: runDrillId }).first()
  if (!result) return
  const data = JSON.parse(result.data)
  data.swimmers = data.swimmers.filter((s: { dbId: string }) => s.dbId !== swimmerDbId)
  await db.laneDrillResults.update(result.id!, {
    data: JSON.stringify(data),
    completed: data.swimmers.length > 0 ? result.completed : false,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Creates a SessionRun from a template, snapshotting all drills into RunDrills.
 * Complex drills are either unrolled (timingMode: 'individual') or grouped (timingMode: 'continuous').
 */
export async function createRunFromTemplate(sessionId: string, runData: { date: string; poolName: string; poolLength: number; notes?: string }): Promise<string> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session template not found')

  const drills = await getDrillsForSession(sessionId)
  drills.sort((a, b) => a.order - b.order)

  const runId = await addSessionRun({
    session_id: sessionId,
    date: runData.date,
    poolName: runData.poolName,
    poolLength: runData.poolLength,
    notes: runData.notes || '',
    status: 'active',
    session_started_at: Date.now(),
    session_paused_at: null,
    session_pause_duration: 0,
  })

  let runDrillOrder = 0
  for (const drill of drills) {
    const items = drill.items || []
    if (items.length === 0) continue

    if (drill.timingMode === 'continuous') {
      // Create one RunDrill for the whole drill block
      const totalDistance = items.reduce((sum, item) => sum + (item.distance * item.repeatCount), 0) * drill.repeatCount
      
      const instructionLines: string[] = []
      const equipmentSet = new Set<string>()
      
      if (drill.repeatCount > 1) instructionLines.push(`${drill.repeatCount}x:`)
      for (const item of items) {
        const intervalText = item.interval ? ` @ ${item.interval}` : ''
        const equipText = item.equipment?.length ? ` [${item.equipment.join(', ')}]` : ''
        instructionLines.push(`${item.repeatCount}x ${item.distance}m ${item.stroke} ${item.intensity || ''}${intervalText}${equipText}`)
        item.equipment?.forEach(e => equipmentSet.add(e))
      }
      
      await addRunDrill({
        run_id: runId,
        name: drill.name,
        stroke: items[0].stroke || 'mixed',
        distance: totalDistance,
        order: runDrillOrder++,
        instructions: instructionLines.join('\n'),
        equipment: Array.from(equipmentSet),
        parent_drill_id: drill.id,
        notes: drill.description || '',
      })
    } else {
      // Unroll items: each repeat of each item gets its own RunDrill record
      for (let r = 0; r < drill.repeatCount; r++) {
        for (const item of items) {
          for (let ir = 0; ir < item.repeatCount; ir++) {
            const setLabel = drill.repeatCount > 1 ? `(${r + 1}/${drill.repeatCount}) ` : ''
            const repLabel = item.repeatCount > 1 ? `[${ir + 1}/${item.repeatCount}]` : ''
            
            await addRunDrill({
              run_id: runId,
              name: `${setLabel}${drill.name}`,
              stroke: item.stroke,
              distance: item.distance,
              order: runDrillOrder++,
              instructions: repLabel || item.intensity || '',
              interval: item.interval,
              equipment: item.equipment,
              parent_drill_id: drill.id,
              notes: drill.description || '',
            })
          }
        }
      }
    }
  }

  return runId
}

// ── Run ↔ Swimmer ──────────────────────────────────────────

export async function getRunSwimmersForRun(runId: string): Promise<RunSwimmer[]> {
  return db.runSwimmers.where('run_id').equals(runId).toArray()
}

export async function addSwimmerToRun(runId: string, swimmerId: string, lane: number): Promise<void> {
  const existing = await db.runSwimmers
    .where({ run_id: runId, swimmer_id: swimmerId })
    .first()
  if (!existing) {
    const now = new Date().toISOString()
    await db.runSwimmers.add({ id: crypto.randomUUID(), run_id: runId, swimmer_id: swimmerId, lane, createdAt: now, updatedAt: now })
  }
}

export async function removeSwimmerFromRun(runId: string, swimmerId: string): Promise<void> {
  await db.runSwimmers
    .where({ run_id: runId, swimmer_id: swimmerId })
    .delete()
}

export async function getSwimmersForRun(runId: string): Promise<Swimmer[]> {
  const links = await db.runSwimmers.where('run_id').equals(runId).toArray()
  const ids = links.map(l => l.swimmer_id)
  if (ids.length === 0) return []
  return db.swimmers.where('id').anyOf(ids).toArray()
}

export async function getRunsForSwimmer(swimmerId: string): Promise<SessionRun[]> {
  const links = await db.runSwimmers.where('swimmer_id').equals(swimmerId).toArray()
  const ids = links.map(l => l.run_id)
  if (ids.length === 0) return []
  return db.sessionRuns.where('id').anyOf(ids).toArray()
}

// ── Laps ───────────────────────────────────────────────────

export async function getAllLaps(): Promise<Lap[]> {
  return db.laps.toArray()
}

export async function getLapsForRunDrill(runDrillId: string): Promise<Lap[]> {
  return db.laps.where('run_drill_id').equals(runDrillId).toArray()
}

export async function getLapsForSwimmerInRun(runId: string, swimmerId: string): Promise<Lap[]> {
  const runDrills = await db.runDrills.where('run_id').equals(runId).toArray()
  const drillIds = runDrills.map(d => d.id)
  if (drillIds.length === 0) return []
  return db.laps.where('run_drill_id').anyOf(drillIds).and(l => l.swimmer_id === swimmerId).toArray()
}

export async function addLap(data: SafeLap): Promise<string> {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.laps.add({ ...data, id, createdAt: now, updatedAt: now })
  return id
}

export async function updateLap(id: string, data: Partial<SafeLap>): Promise<void> {
  await db.laps.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteLap(id: string): Promise<void> {
  await db.laps.delete(id)
}

  // ── Library Drills ─────────────────────────────────────────

export async function getAllLibraryDrills(): Promise<LibraryDrill[]> {
  return db.libraryDrills.orderBy('name').toArray()
}

export const DEFAULT_EQUIPMENT = ['fins', 'zoomers', 'paddles', 'pullbuoy', 'snorkel', 'kickboard']

export async function addLibraryDrill(data: SafeLibraryDrill): Promise<string> {
  const now = new Date().toISOString()

  // Upsert by name: if a drill with the same name already exists, update it
  const existing = await db.libraryDrills.where('name').equals(data.name).first()
  if (existing) {
    await db.libraryDrills.update(existing.id, {
      ...data,
      source: data.source || existing.source || 'personal',
      updatedAt: now,
    })
    return existing.id
  }

  const id = crypto.randomUUID()
  const drill: LibraryDrill = {
    ...data,
    source: data.source || 'personal',
    ...data,
    id,
    items: data.items || [
      {
        id: crypto.randomUUID(),
        distance: data.distance || 0,
        stroke: data.stroke || 'freestyle',
        repeatCount: 1,
      },
    ],
    repeatCount: data.repeatCount || 1,
    timingMode: data.timingMode || 'individual',
    focus: data.focus || 'none',
    labels: data.labels || [],
    description: data.description || '',
    createdAt: now,
    updatedAt: now,
  }
  await db.libraryDrills.add(drill)
  return id
}

export async function deleteLibraryDrill(id: string): Promise<void> {
  await db.libraryDrills.delete(id)
}

export async function patchLibraryDrills(): Promise<void> {
  const defaults = [
    { 
      name: 'Fingertip Drag', 
      focus: 'technique', 
      labels: ['catch', 'rotation'], 
      description: 'Focus on high elbow recovery by dragging fingertips along the water surface. Improves arm recovery and shoulder rotation.' 
    },
    { 
      name: 'Catch-Up Drill', 
      focus: 'technique', 
      labels: ['rhythm', 'streamline'], 
      description: 'Wait for the recovering arm to almost touch the leading hand before starting the next stroke. Improves glide and stroke timing.' 
    },
    { 
      name: '6-1-6 Breathing', 
      focus: 'technique', 
      labels: ['body position', 'rotation', 'breathing'], 
      description: '6 kicks on the side, 1 full stroke, 6 kicks on the other side. Focus on rotation, body alignment, and breath timing.' 
    },
    { 
      name: 'Side Kicking', 
      focus: 'technique', 
      labels: ['body position', 'kick'], 
      description: 'Kick on your side with one arm extended and the other at your side. Focus on a narrow, fast kick and stable body position.' 
    },
    { 
      name: 'Single Arm', 
      focus: 'technique', 
      labels: ['catch', 'rotation'], 
      description: 'Swim with one arm only, keeping the other arm extended forward or at your side. Focus on the pull phase and rotation.' 
    },
    { 
      name: 'Fist Drill', 
      focus: 'technique', 
      labels: ['catch'], 
      description: 'Swim with closed fists to increase awareness of forearm pressure on the water. Teaches you to use your whole arm for the pull.' 
    },
    { 
      name: 'Tarzan Drill', 
      focus: 'technique', 
      labels: ['catch', 'strength'], 
      description: 'Swim with head out of the water, looking forward. Improves catch, high elbow, and stroke power.' 
    },
    { 
      name: 'Sculling', 
      focus: 'technique', 
      labels: ['catch'], 
      description: 'Use small figure-8 hand motions to feel the water pressure. Focus on maintaining a strong "feel" for the water throughout the path.' 
    },
    { 
      name: 'Kickboard Set', 
      focus: 'fitness', 
      labels: ['kick', 'endurance'], 
      description: 'Focused kick work using a board. Focus on high hips and a steady, rhythmic kick from the core.' 
    },
    { 
      name: 'Pull Buoy Set', 
      focus: 'fitness', 
      labels: ['strength', 'endurance', 'body position'], 
      description: 'Swim using a pull buoy. Isolates the upper body to improve stroke power and maintain horizontal alignment.' 
    },
    { 
      name: 'Paddle Work', 
      focus: 'fitness', 
      labels: ['strength', 'catch'], 
      description: 'Swim with hand paddles to increase resistance. Highlights early vertical forearm and high elbow during the pull.' 
    },
    { 
      name: 'Underwater Dolphin Kick', 
      focus: 'technique', 
      labels: ['kick', 'streamline', 'pullout'], 
      description: 'Focus on core-driven movement and staying streamlined. Essential for turns and starts.' 
    },
    { 
      name: 'Streamline Drill', 
      focus: 'technique', 
      labels: ['streamline', 'body position'], 
      description: 'Push off in a tight streamline and hold as long as possible. Teaches "thin" body position to minimize drag.' 
    },
    { 
      name: 'IM Order Practice', 
      focus: 'fitness', 
      labels: ['anaerobic', 'aerobic', 'rhythm'], 
      description: '50m of each stroke in IM order (Fly, Back, Breast, Free). Focus on stroke transitions.' 
    },
    { 
      name: 'Descending Set', 
      focus: 'fitness', 
      labels: ['pacing', 'speed'], 
      description: 'Each subsequent 100m or 50m repeat should be faster than the previous one. Build effort throughout.' 
    },
    { 
      name: 'Broken 100s', 
      focus: 'fitness', 
      labels: ['speed', 'anaerobic', 'pacing'], 
      description: 'Swim 100m broken into smaller segments with short rest to maintain high speed and focus on finish.' 
    },
    { 
      name: 'Kicking on Back', 
      focus: 'technique', 
      labels: ['kick', 'body position'], 
      description: 'Kick on back with arms in streamline. Focus on keeping knees below the surface and hips high.' 
    },
    { 
      name: 'One-Arm Backstroke', 
      focus: 'technique', 
      labels: ['rotation', 'rhythm'], 
      description: 'Swim backstroke with one arm, other arm at side. Focus on shoulder rotation and clean entry.' 
    },
    { 
      name: 'Breaststroke Pullout', 
      focus: 'technique', 
      labels: ['pullout', 'streamline'], 
      description: 'Drill the underwater sequence: 1 massive pull, 1 dolphin kick, 1 breaststroke kick. Focus on minimizing drag.' 
    },
    { 
      name: 'Butterfly Body Motion', 
      focus: 'technique', 
      labels: ['rhythm', 'body position'], 
      description: 'Dolphin kick with arms at sides. Focus on the chest-driven wave motion through the hips.' 
    },
    { 
      name: 'Dolphin Kick on Back', 
      focus: 'technique', 
      labels: ['kick', 'body position'], 
      description: 'Dolphin kick on back. Focus on the upward phase of the kick and core engagement.' 
    },
    { 
      name: 'Breaststroke Kick Only', 
      focus: 'technique', 
      labels: ['kick'], 
      description: 'Kick only with arms extended. Focus on "outsweep-insweep" motion and keeping feet flexed.' 
    },
    { 
      name: 'IM Transition Drill', 
      focus: 'technique', 
      labels: ['rhythm', 'rotation'], 
      description: 'Focus on the specific turns and transitions between strokes (e.g., Fly to Back).' 
    },
    { 
      name: 'Sprint Set', 
      focus: 'fitness', 
      labels: ['sprint', 'speed'], 
      description: '100% effort swimming with maximum recovery. Focus on explosive power and stroke rate.' 
    },
    { 
      name: 'Pace Work 100s', 
      focus: 'fitness', 
      labels: ['pacing', 'aerobic'], 
      description: 'Swim at a specific race-representative pace with controlled rest periods.' 
    },
    { 
      name: 'Aerobic Set', 
      focus: 'fitness', 
      labels: ['aerobic', 'endurance'], 
      description: 'Sustained intensity swimming to build a strong aerobic foundation. Maintain consistent stroke count.' 
    },
  ]

  for (const d of defaults) {
    const existing = await db.libraryDrills.where('name').equals(d.name).first()
    if (existing && (!existing.description || existing.labels?.length === 0 || existing.focus === 'none' || !existing.source)) {
      await db.libraryDrills.update(existing.id, {
        focus: d.focus as 'technique' | 'fitness',
        labels: d.labels,
        description: d.description,
        source: 'builtin',
        updatedAt: new Date().toISOString()
      })
    }
  }
}

export async function deduplicateLibraryDrills(): Promise<number> {
  const all = await db.libraryDrills.toArray()
  const groups = new Map<string, LibraryDrill[]>()
  for (const d of all) {
    const g = groups.get(d.name) || []
    g.push(d)
    groups.set(d.name, g)
  }

  let removed = 0
  for (const [, drills] of groups) {
    if (drills.length <= 1) continue

    // Keep the best entry: prefer builtin source, then most complete data
    drills.sort((a, b) => {
      const aScore = (a.source === 'builtin' ? 2 : 0)
        + (a.description ? 1 : 0)
        + ((a.labels?.length || 0) > 0 ? 1 : 0)
        + (a.focus && a.focus !== 'none' ? 1 : 0)
      const bScore = (b.source === 'builtin' ? 2 : 0)
        + (b.description ? 1 : 0)
        + ((b.labels?.length || 0) > 0 ? 1 : 0)
        + (b.focus && b.focus !== 'none' ? 1 : 0)
      return bScore - aScore
    })
    const [keep, ...rest] = drills

    for (const dup of rest) {
      // Merge items from duplicate if the kept drill has no items
      if (dup.items && dup.items.length > 0 && (!keep.items || keep.items.length === 0)) {
        await db.libraryDrills.update(keep.id, { items: dup.items, updatedAt: new Date().toISOString() })
      }
      await db.libraryDrills.delete(dup.id)
      removed++
    }
  }
  return removed
}

export async function resetLibraryToDefaults(): Promise<void> {
  await db.libraryDrills.clear()
  await seedLibraryDrills()
}

export async function seedLibraryDrills(): Promise<void> {
  const count = await db.libraryDrills.count()
  if (count > 0) return

  const drills: SafeLibraryDrill[] = [
    { 
      name: 'Fingertip Drag', 
      stroke: 'freestyle', 
      distance: 100, 
      focus: 'technique', 
      labels: ['catch', 'rotation'], 
      description: 'Focus on high elbow recovery by dragging fingertips along the water surface. Improves arm recovery and shoulder rotation.' 
    },
    { 
      name: 'Catch-Up Drill', 
      stroke: 'freestyle', 
      distance: 100, 
      focus: 'technique', 
      labels: ['rhythm', 'streamline'], 
      description: 'Wait for the recovering arm to almost touch the leading hand before starting the next stroke. Improves glide and stroke timing.' 
    },
    { 
      name: '6-1-6 Breathing', 
      stroke: 'freestyle', 
      distance: 200, 
      focus: 'technique', 
      labels: ['body position', 'rotation', 'breathing'], 
      description: '6 kicks on the side, 1 full stroke, 6 kicks on the other side. Focus on rotation, body alignment, and breath timing.' 
    },
    { 
      name: 'Side Kicking', 
      stroke: 'freestyle', 
      distance: 100, 
      focus: 'technique', 
      labels: ['body position', 'kick'], 
      description: 'Kick on your side with one arm extended and the other at your side. Focus on a narrow, fast kick and stable body position.' 
    },
    { 
      name: 'Single Arm', 
      stroke: 'freestyle', 
      distance: 100, 
      focus: 'technique', 
      labels: ['catch', 'rotation'], 
      description: 'Swim with one arm only, keeping the other arm extended forward or at your side. Focus on the pull phase and rotation.' 
    },
    { 
      name: 'Fist Drill', 
      stroke: 'freestyle', 
      distance: 100, 
      focus: 'technique', 
      labels: ['catch'], 
      description: 'Swim with closed fists to increase awareness of forearm pressure on the water. Teaches you to use your whole arm for the pull.' 
    },
    { 
      name: 'Tarzan Drill', 
      stroke: 'freestyle', 
      distance: 50, 
      focus: 'technique', 
      labels: ['catch', 'strength'], 
      description: 'Swim with head out of the water, looking forward. Improves catch, high elbow, and stroke power.' 
    },
    { 
      name: 'Sculling', 
      stroke: 'freestyle', 
      distance: 100, 
      focus: 'technique', 
      labels: ['catch'], 
      description: 'Use small figure-8 hand motions to feel the water pressure. Focus on maintaining a strong "feel" for the water throughout the path.' 
    },
    { 
      name: 'Kickboard Set', 
      stroke: 'freestyle', 
      distance: 200, 
      focus: 'fitness', 
      labels: ['kick', 'endurance'], 
      description: 'Focused kick work using a board. Focus on high hips and a steady, rhythmic kick from the core.' 
    },
    { 
      name: 'Pull Buoy Set', 
      stroke: 'freestyle', 
      distance: 200, 
      focus: 'fitness', 
      labels: ['strength', 'endurance', 'body position'], 
      description: 'Swim using a pull buoy. Isolates the upper body to improve stroke power and maintain horizontal alignment.' 
    },
    { 
      name: 'Paddle Work', 
      stroke: 'freestyle', 
      distance: 200, 
      focus: 'fitness', 
      labels: ['strength', 'catch'], 
      description: 'Swim with hand paddles to increase resistance. Highlights early vertical forearm and high elbow during the pull.' 
    },
    { 
      name: 'Underwater Dolphin Kick', 
      stroke: 'butterfly', 
      distance: 25, 
      focus: 'technique', 
      labels: ['kick', 'streamline', 'pullout'], 
      description: 'Focus on core-driven movement and staying streamlined. Essential for turns and starts.' 
    },
    { 
      name: 'Streamline Drill', 
      stroke: 'freestyle', 
      distance: 50, 
      focus: 'technique', 
      labels: ['streamline', 'body position'], 
      description: 'Push off in a tight streamline and hold as long as possible. Teaches "thin" body position to minimize drag.' 
    },
    { 
      name: 'IM Order Practice', 
      stroke: 'im', 
      distance: 200, 
      focus: 'fitness', 
      labels: ['anaerobic', 'aerobic', 'rhythm'], 
      description: '50m of each stroke in IM order (Fly, Back, Breast, Free). Focus on stroke transitions.' 
    },
    { 
      name: 'Descending Set', 
      stroke: 'freestyle', 
      distance: 400, 
      focus: 'fitness', 
      labels: ['pacing', 'speed'], 
      description: 'Each subsequent 100m or 50m repeat should be faster than the previous one. Build effort throughout.' 
    },
    { 
      name: 'Broken 100s', 
      stroke: 'freestyle', 
      distance: 100, 
      focus: 'fitness', 
      labels: ['speed', 'anaerobic', 'pacing'], 
      description: 'Swim 100m broken into smaller segments with short rest to maintain high speed and focus on finish.' 
    },
    { 
      name: 'Kicking on Back', 
      stroke: 'backstroke', 
      distance: 100, 
      focus: 'technique', 
      labels: ['kick', 'body position'], 
      description: 'Kick on back with arms in streamline. Focus on keeping knees below the surface and hips high.' 
    },
    { 
      name: 'One-Arm Backstroke', 
      stroke: 'backstroke', 
      distance: 100, 
      focus: 'technique', 
      labels: ['rotation', 'rhythm'], 
      description: 'Swim backstroke with one arm, other arm at side. Focus on shoulder rotation and clean entry.' 
    },
    { 
      name: 'Breaststroke Pullout', 
      stroke: 'breaststroke', 
      distance: 50, 
      focus: 'technique', 
      labels: ['pullout', 'streamline'], 
      description: 'Drill the underwater sequence: 1 massive pull, 1 dolphin kick, 1 breaststroke kick. Focus on minimizing drag.' 
    },
    { 
      name: 'Butterfly Body Motion', 
      stroke: 'butterfly', 
      distance: 50, 
      focus: 'technique', 
      labels: ['rhythm', 'body position'], 
      description: 'Dolphin kick with arms at sides. Focus on the chest-driven wave motion through the hips.' 
    },
    { 
      name: 'Dolphin Kick on Back', 
      stroke: 'backstroke', 
      distance: 50, 
      focus: 'technique', 
      labels: ['kick', 'body position'], 
      description: 'Dolphin kick on back. Focus on the upward phase of the kick and core engagement.' 
    },
    { 
      name: 'Breaststroke Kick Only', 
      stroke: 'breaststroke', 
      distance: 100, 
      focus: 'technique', 
      labels: ['kick'], 
      description: 'Kick only with arms extended. Focus on "outsweep-insweep" motion and keeping feet flexed.' 
    },
    { 
      name: 'IM Transition Drill', 
      stroke: 'im', 
      distance: 100, 
      focus: 'technique', 
      labels: ['rhythm', 'rotation'], 
      description: 'Focus on the specific turns and transitions between strokes (e.g., Fly to Back).' 
    },
    { 
      name: 'Sprint Set', 
      stroke: 'freestyle', 
      distance: 50, 
      focus: 'fitness', 
      labels: ['sprint', 'speed'], 
      description: '100% effort swimming with maximum recovery. Focus on explosive power and stroke rate.' 
    },
    { 
      name: 'Pace Work 100s', 
      stroke: 'freestyle', 
      distance: 100, 
      focus: 'fitness', 
      labels: ['pacing', 'aerobic'], 
      description: 'Swim at a specific race-representative pace with controlled rest periods.' 
    },
    { 
      name: 'Aerobic Set', 
      stroke: 'freestyle', 
      distance: 400, 
      focus: 'fitness', 
      labels: ['aerobic', 'endurance'], 
      description: 'Sustained intensity swimming to build a strong aerobic foundation. Maintain consistent stroke count.' 
    },
  ]

  for (const d of drills) {
    await addLibraryDrill({ ...d, source: 'builtin' })
  }
}

// ── Equipment Options ──────────────────────────────────────

export async function getEquipmentOptions(): Promise<string[]> {
  const meta = await db.meta.get('equipment')
  if (meta) return JSON.parse(meta.value)
  return DEFAULT_EQUIPMENT
}

export async function setEquipmentOptions(items: string[]): Promise<void> {
  await db.meta.put({ key: 'equipment', value: JSON.stringify(items) })
}

// ── DB Management ───────────────────────────────────────────

export async function estimateDbSize(): Promise<{ bytes: number; tables: Record<string, number> }> {
  const tables = db.tables.filter(t => !t.name.startsWith('_'))
  const tableSizes: Record<string, number> = {}
  let totalBytes = 0

  for (const table of tables) {
    const rows = await table.toArray()
    const bytes = new Blob([JSON.stringify(rows)]).size
    tableSizes[table.name] = bytes
    totalBytes += bytes
  }

  // Include localStorage backup blob if present
  const backupRaw = localStorage.getItem('swimsheet_db_backup')
  if (backupRaw) {
    totalBytes += new Blob([backupRaw]).size
  }

  return { bytes: totalBytes, tables: tableSizes }
}

export async function exportSwimmerData(swimmerId: string): Promise<Blob> {
  const swimmer = await db.swimmers.get(swimmerId)
  if (!swimmer) throw new Error('Swimmer not found')

  const runLinks = await db.runSwimmers.where('swimmer_id').equals(swimmerId).toArray()
  const runIds = runLinks.map(l => l.run_id)

  const runs = runIds.length > 0
    ? await db.sessionRuns.where('id').anyOf(runIds).toArray()
    : []

  const runDrills = runIds.length > 0
    ? await db.runDrills.where('run_id').anyOf(runIds).toArray()
    : []

  const runDrillIds = runDrills.map(d => d.id)
  const laps = runDrillIds.length > 0
    ? await db.laps.where('run_drill_id').anyOf(runDrillIds).toArray()
    : []

  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
    swimmer,
    runs,
    runDrills,
    laps,
  }

  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

export async function deleteSwimmerWithData(swimmerId: string): Promise<Blob | null> {
  const swimmer = await db.swimmers.get(swimmerId)
  if (!swimmer) return null

  // Export data first
  const blob = await exportSwimmerData(swimmerId)

  // Find and remove all associations
  const runLinks = await db.runSwimmers.where('swimmer_id').equals(swimmerId).toArray()
  const runIds = runLinks.map(l => l.run_id)

  if (runIds.length > 0) {
    const runDrills = await db.runDrills.where('run_id').anyOf(runIds).toArray()
    const runDrillIds = runDrills.map(d => d.id)

    await db.transaction('rw', [db.laps, db.runDrills, db.runSwimmers, db.sessionRuns, db.laneDrillResults, db.swimmers], async () => {
      if (runDrillIds.length > 0) {
        await db.laps.where('run_drill_id').anyOf(runDrillIds).delete()
      }
      await db.runDrills.where('run_id').anyOf(runIds).delete()
      await db.runSwimmers.where('swimmer_id').equals(swimmerId).delete()
      await db.sessionRuns.where('id').anyOf(runIds).delete()
      // Clean lane drill results for these runs
      await db.laneDrillResults.where('run_id').anyOf(runIds).delete()
      await db.swimmers.delete(swimmerId)
    })
  } else {
    await db.swimmers.delete(swimmerId)
  }

  return blob
}

export async function cleanupOldData(retentionDays: number): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)
  const cutoffStr = cutoff.toISOString()

  // Find old completed runs
  const oldRuns = await db.sessionRuns
    .where('status').equals('completed')
    .and(r => r.date < cutoffStr)
    .toArray()

  if (oldRuns.length === 0) return 0

  const runIds = oldRuns.map(r => r.id)
  const runDrills = await db.runDrills.where('run_id').anyOf(runIds).toArray()
  const runDrillIds = runDrills.map(d => d.id)

  await db.transaction('rw', [db.laps, db.runDrills, db.runSwimmers, db.sessionRuns, db.laneDrillResults], async () => {
    if (runDrillIds.length > 0) {
      await db.laps.where('run_drill_id').anyOf(runDrillIds).delete()
    }
    await db.runDrills.where('run_id').anyOf(runIds).delete()
    await db.runSwimmers.where('run_id').anyOf(runIds).delete()
    await db.laneDrillResults.where('run_id').anyOf(runIds).delete()
    await db.sessionRuns.where('id').anyOf(runIds).delete()
  })

  return oldRuns.length
}
