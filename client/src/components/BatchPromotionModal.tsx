import { useState } from 'react'
import { searchSwimmers } from '../api/swimmers'
import { promoteAndLinkSwimmer, discardTempSwimmer } from '../api/runs'

interface SwimmerToPromote {
  name: string
  dbId: string
}

interface PromotionChoice {
  swimmer: SwimmerToPromote
  selectedRosterId?: string
  newSwimmerName?: string
  promote: boolean
}

interface BatchPromotionModalProps {
  open: boolean
  swimmers: SwimmerToPromote[]
  runId: string
  onConfirm: () => void
  onCancel: () => void
}

export function BatchPromotionModal({ open, swimmers, runId, onConfirm, onCancel }: BatchPromotionModalProps) {
  const [userChoices, setUserChoices] = useState<Record<string, Partial<PromotionChoice>>>({})
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({})
  const [searchResults, setSearchResults] = useState<Record<string, Array<{ id: string; name: string }>>>({})
  const [saving, setSaving] = useState(false)

  const getChoice = (dbId: string): PromotionChoice => {
    const userChoice = userChoices[dbId]
    const base = swimmers.find(s => s.dbId === dbId)
    if (!base) return { swimmer: { name: '', dbId }, promote: false }
    return { 
      swimmer: base,
      selectedRosterId: userChoice?.selectedRosterId,
      newSwimmerName: userChoice?.newSwimmerName,
      promote: userChoice?.promote !== false
    }
  }

  const handleSearch = async (dbId: string, query: string) => {
    setSearchQueries(prev => ({ ...prev, [dbId]: query }))
    if (query.length < 2) {
      setSearchResults(prev => ({ ...prev, [dbId]: [] }))
      return
    }
    const results = await searchSwimmers(query)
    setSearchResults(prev => ({ ...prev, [dbId]: results.slice(0, 5) }))
  }

  const handleSelectRoster = (dbId: string, rosterId: string, rosterName: string) => {
    setUserChoices(prev => ({ 
      ...prev, 
      [dbId]: { ...prev[dbId], selectedRosterId: rosterId, newSwimmerName: undefined }
    }))
    setSearchQueries(prev => ({ ...prev, [dbId]: rosterName }))
    setSearchResults(prev => ({ ...prev, [dbId]: [] }))
  }

  const handleTogglePromote = (dbId: string) => {
    setUserChoices(prev => ({
      ...prev,
      [dbId]: { ...prev[dbId], promote: prev[dbId]?.promote === false ? true : false }
    }))
  }

  const handleConfirm = async () => {
    setSaving(true)
    try {
      for (const swimmer of swimmers) {
        const choice = getChoice(swimmer.dbId)
        if (!choice.promote) {
          await discardTempSwimmer(runId, swimmer.dbId)
          continue
        }

        const realName = choice.selectedRosterId
          ? swimmer.name
          : choice.newSwimmerName || swimmer.name

        await promoteAndLinkSwimmer(runId, swimmer.dbId, realName, choice.selectedRosterId)
      }
      onConfirm()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-outline-variant">
          <h2 className="font-headline-md text-on-surface">Promote Swimmers to Roster</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Choose which swimmers to save to your permanent roster.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {swimmers.map(swimmer => {
            const choice = getChoice(swimmer.dbId)
            return (
              <div 
                key={swimmer.dbId}
                className={`rounded-xl border p-3 transition-all ${choice.promote ? 'border-primary bg-primary-container/10' : 'border-outline-variant bg-surface-container'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={choice.promote}
                      onChange={() => handleTogglePromote(swimmer.dbId)}
                      className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer"
                    />
                    <span className="font-medium text-on-surface truncate">{swimmer.name}</span>
                  </div>
                  {!choice.promote && (
                    <span className="text-label-sm text-on-surface-variant">Will not be saved</span>
                  )}
                </div>

                {choice.promote && (
                  <div className="mt-3 space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search existing swimmer or type new name..."
                        value={searchQueries[swimmer.dbId] || ''}
                        onChange={(e) => handleSearch(swimmer.dbId, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-surface text-on-surface text-sm border border-outline-variant focus:border-primary focus:outline-none"
                      />
                      {searchResults[swimmer.dbId]?.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest rounded-lg border border-outline-variant shadow-lg z-10 max-h-40 overflow-y-auto">
                          {searchResults[swimmer.dbId].map(result => (
                            <button
                              key={result.id}
                              onClick={() => handleSelectRoster(swimmer.dbId, result.id, result.name)}
                              className="w-full px-3 py-2 text-left hover:bg-surface-variant transition-all cursor-pointer"
                            >
                              <div className="text-sm font-medium text-on-surface">{result.name}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {choice.selectedRosterId && (
                      <p className="text-xs text-primary">Linking to existing swimmer in roster</p>
                    )}
                    {!choice.selectedRosterId && searchQueries[swimmer.dbId] && (
                      <p className="text-xs text-on-surface-variant">Will create new swimmer with this name</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-4 border-t border-outline-variant flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-on-surface-variant font-medium hover:bg-surface-variant transition-all cursor-pointer disabled:opacity-50"
          >
            Skip All
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || swimmers.filter(s => getChoice(s.dbId).promote).length === 0}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : `Promote ${swimmers.filter(s => getChoice(s.dbId).promote).length} Swimmer${swimmers.filter(s => getChoice(s.dbId).promote).length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}