import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { NAV_ITEMS } from '@/components/layout/navConfig'
import { useWorkerStore } from '@/store/useWorkerStore'
import { useTranslation } from '@/i18n/useTranslation'
import type { Worker, Permissions, ActionKey, ModuleKey } from '@/types'
import { commit } from '@/utils/mutate'

const ACTIONS: ActionKey[] = ['view', 'create', 'edit', 'delete', 'print', 'pay']

export const PermissionsModal = ({ open, onClose, worker }: { open: boolean; onClose: () => void; worker: Worker }) => {
  const { t } = useTranslation()
  const setPermissions = useWorkerStore((s) => s.setPermissions)
  const [perms, setPerms] = useState<Permissions>({})

  useEffect(() => {
    if (open) setPerms(JSON.parse(JSON.stringify(worker.permissions ?? {})))
  }, [open, worker])

  const toggleModule = (key: ModuleKey, enabled: boolean) =>
    setPerms((p) => ({
      ...p,
      [key]: { enabled, actions: enabled ? p[key]?.actions ?? ['view'] : [] },
    }))

  const toggleAction = (key: ModuleKey, action: ActionKey) =>
    setPerms((p) => {
      const cur = p[key]?.actions ?? []
      const next = cur.includes(action) ? cur.filter((a) => a !== action) : [...cur, action]
      return { ...p, [key]: { enabled: true, actions: next } }
    })

  const save = () => {
    commit(setPermissions(worker.id, perms), { success: t('saved') })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('permissions')}
      subtitle={worker.fullName}
      size="lg"
      footer={<><Button variant="outline" onClick={onClose}>{t('cancel')}</Button><Button onClick={save}><Check size={16} />{t('save')}</Button></>}
    >
      <div className="space-y-2">
        {NAV_ITEMS.map((item) => {
          const enabled = perms[item.key]?.enabled ?? false
          return (
            <div key={item.key} className="border border-wood-light p-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={enabled} onChange={(e) => toggleModule(item.key, e.target.checked)} className="h-4 w-4 accent-wood-warm" />
                <item.icon size={17} className="text-wood-medium" />
                <span className="font-semibold text-wood-dark">{t(item.labelKey)}</span>
              </label>
              <AnimatePresence>
                {enabled && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-2 flex flex-wrap gap-2 ps-9">
                      {ACTIONS.map((a) => {
                        const checked = perms[item.key]?.actions.includes(a) ?? false
                        return (
                          <button
                            key={a}
                            onClick={() => toggleAction(item.key, a)}
                            className={`border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                              checked ? 'border-sage bg-sage/12 text-sage' : 'border-wood-light text-wood-medium hover:bg-wood-cream'
                            }`}
                          >
                            {t(a)}
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
