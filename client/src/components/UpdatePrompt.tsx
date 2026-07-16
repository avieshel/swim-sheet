import { useRegisterSW } from 'virtual:pwa-register/react'

export const UpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-28 md:bottom-16 left-1/2 -translate-x-1/2 z-[100] w-[90vw] max-w-md animate-slide-up">
      <div className="bg-surface-container-lowest rounded-2xl px-5 py-4 shadow-2xl border border-outline-variant">
        <p className="font-body-md font-semibold text-on-surface mb-3">
          A new version of Swim Sheet is available
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => updateServiceWorker(true)}
            className="flex-1 bg-primary text-on-primary font-bold px-4 py-2.5 rounded-xl hover:brightness-110 transition-all active:scale-95 text-sm"
          >
            Update
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="flex-1 bg-surface-variant text-on-surface-variant font-bold px-4 py-2.5 rounded-xl hover:bg-surface transition-all active:scale-95 text-sm"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
