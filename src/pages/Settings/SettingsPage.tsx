import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Store, UserCog, Database, Download, Upload, Check, Eraser, Image as ImageIcon, Sun, Moon } from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useThemeStore } from '@/store/useThemeStore'
import { useTranslation } from '@/i18n/useTranslation'
import { exportData, restoreData } from '@/utils/export'
import { uploadImage } from '@/lib/imageUpload'
import { pruneOrphanImages } from '@/lib/storageCleanup'
import { formatBytes, savedPercent } from '@/utils/media'
import { fadeUp, staggerContainer } from '@/utils/animations'
import { commit } from '@/utils/mutate'
import { useBootstrap } from '@/store/bootstrap'

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <motion.div variants={fadeUp} className="card-wood min-w-0 rounded-2xl p-4 sm:p-5">
    <div className="mb-4 flex items-center gap-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-wood-btn text-accentfg">{icon}</div>
      <h3 className="text-display text-lg font-bold text-wood-dark">{title}</h3>
    </div>
    {children}
  </motion.div>
)

export const SettingsPage = () => {
  const { t, lang, setLang } = useTranslation()
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const { settings, updateSettings } = useSettingsStore()
  const loadAll = useBootstrap((s) => s.loadAll)
  const [restoring, setRestoring] = useState(false)
  const { currentUser, updateAccount } = useAuthStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  const [logoBusy, setLogoBusy] = useState(false)
  const [pruning, setPruning] = useState(false)
  const [confirmPrune, setConfirmPrune] = useState(false)
  const [store, setStore] = useState(settings)
  const [account, setAccount] = useState({
    fullName: currentUser?.fullName ?? '',
    username: currentUser?.username ?? '',
    email: currentUser?.email ?? '',
    password: currentUser?.password ?? '',
  })

  const saveStore = () => commit(updateSettings(store), { success: t('saved') })

  /**
   * The display fields go to `public.profiles`; a changed e-mail or password is
   * an `auth.users` write. Either can be refused — a duplicate address, a
   * password below the project's minimum — so the result is reported rather
   * than assumed.
   */
  const saveAccount = async () => {
    const result = await updateAccount(account)
    if (result.ok) toast.success(t('saved'))
    else toast.error(result.message ?? t('saveFailed'))
  }

  /**
   * The logo is printed on every invoice and shown in the header, so it goes
   * through the same squeeze as the storefront photos: a 6 MB picture becomes
   * a ~100 KB WebP in the `store-assets` bucket instead of a base64 blob that
   * every backup would have to carry.
   */
  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoBusy(true)
    try {
      const result = await uploadImage(file, {
        bucket: 'store-assets',
        folder: 'logo',
        preset: 'logo',
      })
      setStore((s) => ({ ...s, logo: result.src }))
      await updateSettings({ logo: result.src })
      const saved = savedPercent(result.originalSize, result.size)
      toast.success(
        saved >= 5
          ? `${t('imageCompressed')} · ${formatBytes(result.originalSize)} → ${formatBytes(result.size)} (−${saved} %)`
          : t('saved'),
      )
    } catch {
      toast.error(t('imageUploadFailed'))
    } finally {
      setLogoBusy(false)
      e.target.value = ''
    }
  }

  /**
   * Reclaim bucket images no longer pointed at by any article, offer, carrier
   * or setting — the residue of replaced photos and abandoned drafts. Anything
   * uploaded in the last 24 h is left alone, so a form still open somewhere
   * cannot lose its photos.
   */
  const onPrune = async () => {
    setConfirmPrune(false)
    setPruning(true)
    const result = await pruneOrphanImages()
    setPruning(false)

    if (result.status === 'not-configured') return toast.error(t('storageOffline'))
    if (result.status === 'not-loaded') return toast.error(t('storageNothingToScan'))
    if (result.status === 'failed') return toast.error(result.message)
    if (result.deleted === 0) return toast.success(t('storageAlreadyClean'))
    toast.success(`${t('storageCleaned')} · ${result.deleted} · ${formatBytes(result.freed)}`)
  }

  /**
   * Replay a snapshot's master data into Supabase, then read the boutique back
   * so the screen shows what the database actually holds. The ledgers in the
   * file are reported rather than replayed — see `restoreData`.
   */
  const onRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRestoring(true)
    try {
      const report = await restoreData(file)
      await loadAll()

      const written = report.restored.reduce((n, r) => n + r.count, 0)
      toast.success(`${t('dataRestored')} · ${written}`)
      if (report.skipped.length > 0) {
        toast(`${t('restoreSkipped')} : ${report.skipped.join(', ')}`, {
          icon: 'ℹ️',
          duration: 7000,
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setRestoring(false)
      e.target.value = ''
    }
  }

  return (
    <div>
      <PageHeader title={t('settings')} />
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Store info */}
        <div className="lg:col-span-2">
          <Section title={t('storeInfo')} icon={<Store size={20} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Logo */}
              <div className="flex items-center gap-4 sm:col-span-2">
                {store.logo ? (
                  <img src={store.logo} alt="logo" className="h-20 w-20 rounded-xl object-cover shadow-wood" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-wood-cream text-wood-light"><ImageIcon size={28} /></div>
                )}
                <div>
                  <p className="label-wood">{t('uploadLogo')}</p>
                  <input ref={logoRef} type="file" accept="image/*" onChange={onLogo} className="hidden" />
                  <Button variant="outline" size="sm" disabled={logoBusy} onClick={() => logoRef.current?.click()}><Upload size={15} />{logoBusy ? t('compressingImage') : t('uploadLogo')}</Button>
                </div>
              </div>
              <Input label={t('storeName')} value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} />
              <Input label={t('phone')} value={store.phone} onChange={(e) => setStore({ ...store, phone: e.target.value })} />
              <Input label={t('email')} value={store.email} onChange={(e) => setStore({ ...store, email: e.target.value })} />
              <Input label={t('address')} value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} />
              <div className="sm:col-span-2"><Textarea label={t('description')} value={store.description} onChange={(e) => setStore({ ...store, description: e.target.value })} /></div>
              <Input label="NIF" value={store.nif} onChange={(e) => setStore({ ...store, nif: e.target.value })} />
              <Input label="NIS" value={store.nis} onChange={(e) => setStore({ ...store, nis: e.target.value })} />
              <Input label="N° Article" value={store.article} onChange={(e) => setStore({ ...store, article: e.target.value })} />
              <Input label="RC" value={store.rc} onChange={(e) => setStore({ ...store, rc: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end"><Button action="edit" onClick={saveStore}><Check size={16} />{t('save')}</Button></div>
          </Section>
        </div>

        {/* Account */}
        <Section title={t('myAccount')} icon={<UserCog size={20} />}>
          <div className="space-y-4">
            <Input label={t('fullName')} value={account.fullName} onChange={(e) => setAccount({ ...account, fullName: e.target.value })} />
            <Input label={t('username')} value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value })} />
            <Input label={t('email')} value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} />
            <Input label={t('password')} value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} />
            <div className="flex justify-end"><Button onClick={() => void saveAccount()}><Check size={16} />{t('save')}</Button></div>
          </div>
          <div className="mt-5 border-t border-wood-light/20 pt-4">
            <p className="label-wood">{t('language')}</p>
            <div className="flex gap-2">
              <Button variant={lang === 'fr' ? 'primary' : 'outline'} size="sm" onClick={() => setLang('fr')}>{t('french')}</Button>
              <Button variant={lang === 'ar' ? 'primary' : 'outline'} size="sm" onClick={() => setLang('ar')}>{t('arabic')}</Button>
            </div>
          </div>
          <div className="mt-5 border-t border-wood-light/20 pt-4">
            <p className="label-wood">{t('appearance')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['light', 'dark'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTheme(mode)}
                  aria-pressed={theme === mode}
                  className={`flex items-center gap-3 rounded-xl border p-2.5 text-start transition ${
                    theme === mode ? 'border-gold bg-gold/10' : 'border-wood-light hover:border-gold/60'
                  }`}
                >
                  {/* A miniature of each palette, so the choice is seen, not described */}
                  <span
                    className={`flex h-10 w-12 shrink-0 flex-col justify-between rounded-lg border p-1.5 ${
                      mode === 'light' ? 'border-[#E6E1D6] bg-[#F7F6F2]' : 'border-[#302D28] bg-[#0A0A0B]'
                    }`}
                  >
                    <span className={`h-1.5 w-7 rounded-full ${mode === 'light' ? 'bg-[#111]' : 'bg-[#F6F3EC]'}`} />
                    <span className="h-2.5 w-5 rounded bg-gradient-to-r from-[#E9C977] to-[#B8913A]" />
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-wood-dark">
                    {mode === 'light' ? <Sun size={15} /> : <Moon size={15} />}
                    <span className="truncate">{mode === 'light' ? t('lightMode') : t('darkMode')}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Data */}
        <Section title={t('database')} icon={<Database size={20} />}>
          <div className="space-y-4">
            <p className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2.5 text-xs text-wood-dark">
              {t('demoDataNotice')}
            </p>
            <div className="rounded-xl border border-wood-light/25 p-4">
              <p className="font-semibold text-wood-dark">{t('backup')}</p>
              <p className="mb-3 text-xs text-wood-medium">{t('backupHint')}</p>
              <Button variant="sage" onClick={() => { exportData(); toast.success(t('saved')) }}><Download size={16} />{t('backup')}</Button>
            </div>
            <div className="rounded-xl border border-wood-light/25 p-4">
              <p className="font-semibold text-wood-dark">{t('restore')}</p>
              <p className="mb-3 text-xs text-wood-medium">{t('restoreHint')}</p>
              <input ref={fileRef} type="file" accept="application/json" onChange={onRestore} className="hidden" />
              <Button variant="gold" disabled={restoring} onClick={() => fileRef.current?.click()}><Upload size={16} />{restoring ? t('loading') : t('restore')}</Button>
            </div>
            <div className="rounded-xl border border-wood-light/25 p-4">
              <p className="font-semibold text-wood-dark">{t('cleanStorage')}</p>
              <p className="mb-3 text-xs text-wood-medium">{t('cleanStorageHint')}</p>
              <Button variant="outline" disabled={pruning} onClick={() => setConfirmPrune(true)}>
                <Eraser size={16} />{pruning ? t('loading') : t('cleanStorage')}
              </Button>
            </div>
          </div>
        </Section>
      </motion.div>

      <ConfirmDialog
        open={confirmPrune}
        onClose={() => setConfirmPrune(false)}
        onConfirm={onPrune}
        title={t('cleanStorage')}
        message={t('cleanStorageConfirm')}
      />
    </div>
  )
}
