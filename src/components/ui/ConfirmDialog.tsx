import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { useTranslation } from '@/i18n/useTranslation'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message?: string
  /** Defaults to "Delete" — override for confirmations that are not removals. */
  confirmLabel?: string
  /** `danger` (default) for destructive steps, `primary` for ordinary ones. */
  tone?: 'danger' | 'primary' | 'sage'
  icon?: ReactNode
}

export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  tone = 'danger',
  icon,
}: ConfirmDialogProps) => {
  const { t } = useTranslation()
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
            tone === 'danger' ? 'bg-terracotta/10 text-terracotta' : 'bg-wood-cream text-wood-dark'
          }`}
        >
          {icon ?? <AlertTriangle size={28} />}
        </div>
        <h3 className="text-display text-lg font-black uppercase text-wood-dark">
          {title ?? t('confirmDelete')}
        </h3>
        <p className="text-sm leading-relaxed text-wood-medium">
          {message ?? t('confirmDeleteMsg')}
        </p>
        <div className="mt-2 flex w-full gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant={tone}
            className="flex-1"
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel ?? t('delete')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
