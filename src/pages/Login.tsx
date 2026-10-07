import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  Globe,
  UserPlus,
  LogIn,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTranslation } from '@/i18n/useTranslation'
import { Button } from '@/components/ui/Button'

// Supabase authenticates on the e-mail address, so that is what the field
// takes — a username has nothing to sign in against.
const loginSchema = z.object({
  identifier: z.string().email(),
  password: z.string().min(1),
})
type LoginForm = z.infer<typeof loginSchema>

/** Dark-surface field: the login screen is the one page that is always black. */
const darkField =
  'w-full rounded-xl border border-white/15 bg-white/[0.07] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-indigo-300 focus:bg-white/10 focus:ring-4 focus:ring-indigo-400/20'

const darkLabel = 'mb-1.5 block text-xs font-semibold text-white/60'

export const Login = () => {
  const { t, toggleLang, lang } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = useAuthStore((s) => s.currentUser)
  const login = useAuthStore((s) => s.login)
  const createAdmin = useAuthStore((s) => s.createAdmin)
  const adminExists = useAuthStore((s) => s.adminExists)
  const dbError = useAuthStore((s) => s.dbError)
  const settings = useSettingsStore((s) => s.settings)
  const [showCreate, setShowCreate] = useState(false)
  const [busy, setBusy] = useState(false)

  /**
   * The creation flow is offered only once Supabase has confirmed the boutique
   * has *no* owner. While the answer is still unknown (`null`) it stays hidden,
   * so it can never flash on screen for a boutique that is already claimed —
   * and the moment an owner is registered the store flips this to `true` and
   * the whole section retires itself.
   */
  const offerCreateAdmin = adminExists === false

  /** The page the guard turned away, so signing in resumes it. */
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onLogin = async (data: LoginForm) => {
    setBusy(true)
    try {
      const result = await login(data.identifier, data.password)
      if (result.ok) {
        toast.success(`${t('welcomeBack')}, ${result.user.fullName}`)
        navigate(from, { replace: true })
        return
      }
      // The three refusals mean different things to whoever is standing there,
      // so they are not collapsed into one "wrong password".
      if (result.reason === 'disabled') toast.error(t('accountDisabled'))
      else if (result.reason === 'not-configured') toast.error(t('dbNotConfigured'))
      else if (result.reason === 'error') toast.error(result.message ?? t('connectionError'))
      else toast.error(t('wrongCredentials'))
    } finally {
      setBusy(false)
    }
  }

  const createSchema = z
    .object({
      fullName: z.string().min(2),
      username: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(4),
      confirm: z.string().min(4),
    })
    .refine((d) => d.password === d.confirm, { path: ['confirm'], message: t('passwordMismatch') })
  type CreateForm = z.infer<typeof createSchema>

  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema) })

  const onCreate = async (data: CreateForm) => {
    // A second administrator can never be created from the public login page.
    if (useAuthStore.getState().adminExists) {
      toast.error(t('adminExists'))
      setShowCreate(false)
      return
    }

    setBusy(true)
    try {
      const result = await createAdmin({
        fullName: data.fullName,
        username: data.username,
        email: data.email,
        password: data.password,
      })

      if (!result.ok) {
        toast.error(result.message ?? t('connectionError'))
        return
      }

      // The account is in `auth.users` either way, so the section collapses on
      // its own. Whether the owner is carried straight in depends on the
      // project: with e-mail confirmation on, Supabase issues no session yet.
      toast.success(t('accountCreated'))
      setShowCreate(false)
      if (result.signedIn) navigate('/dashboard', { replace: true })
      else toast(t('confirmEmailToSignIn'), { icon: 'ℹ️', duration: 6000 })
    } finally {
      setBusy(false)
    }
  }

  // Already signed in — reaching /login by refresh, a bookmark or the back
  // button should not ask for the password again.
  if (currentUser) return <Navigate to={from} replace />

  const storeName = settings.name || t('appName')

  return (
    <div className="relative flex min-h-screen bg-gradient-to-br from-[#1E1B4B] via-[#2E1065] to-[#4C1D95]">
      {/* ── Editorial half: the brand, full-bleed ──────────────────────────── */}
      <div className="wood-grain relative hidden flex-1 overflow-hidden border-e border-white/10 lg:flex">
        <div className="absolute inset-0 flex flex-col justify-between p-14">
          <div className="flex items-center gap-3">
            {settings.logo ? (
              <img src={settings.logo} alt="" className="h-11 w-11 object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
                <span className="text-display text-xl font-black text-indigo-700">
                  {storeName.slice(0, 1).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-display text-sm font-black uppercase tracking-widest text-white">
              {storeName}
            </span>
          </div>

          <div>
            {/* Each word rises from behind its own mask — the signature reveal. */}
            {[t('appName'), t('appSubtitle')].map((line, i) => (
              <span key={line} className="block overflow-hidden">
                <motion.span
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.15 + i * 0.12, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className={
                    i === 0
                      ? 'text-hero block text-[clamp(2.75rem,6vw,5.5rem)] text-white'
                      : 'text-hero block text-[clamp(2.75rem,6vw,5.5rem)] text-white/25'
                  }
                >
                  {line}
                </motion.span>
              </span>
            ))}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="mt-6 max-w-md text-sm leading-relaxed text-white/45"
            >
              {settings.description || t('appTagline')}
            </motion.p>
          </div>

          <div className="flex items-center gap-8 text-[10px] font-bold uppercase tracking-widest text-white/35">
            <span>{t('deliveryToAllWilayas')}</span>
            <span className="h-3 w-px bg-white/20" />
            <span>{t('securePayment')}</span>
          </div>
        </div>
      </div>

      {/* ── Form half ──────────────────────────────────────────────────────── */}
      <div className="relative flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-[520px] lg:shrink-0">
        {/* Utilities */}
        <div className="absolute end-6 top-6 flex items-center gap-2 sm:end-12">
          <a
            href="/shop"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 border border-white/20 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/70 transition hover:border-white hover:text-white"
          >
            <ExternalLink size={13} />
            {t('visitWebsite')}
          </a>
          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center gap-1.5 border border-white/20 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/70 transition hover:border-white hover:text-white"
          >
            <Globe size={13} />
            {lang === 'fr' ? 'ع' : 'FR'}
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-sm"
        >
          {/* Compact brand for the small-screen layout */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            {settings.logo ? (
              <img src={settings.logo} alt="" className="h-10 w-10 object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
                <span className="text-display text-lg font-black text-indigo-700">
                  {storeName.slice(0, 1).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-display text-sm font-black uppercase tracking-widest text-white">
              {storeName}
            </span>
          </div>

          <p className="eyebrow text-white/40">{t('login')}</p>
          <h2 className="text-hero mt-2 text-4xl text-white">{t('welcomeBack')}</h2>
          <p className="mt-3 text-xs leading-relaxed text-white/45">{t('loginSubtitle')}</p>

          <form onSubmit={handleSubmit(onLogin)} className="mt-8 space-y-4">
            <div>
              <label className={darkLabel}>{t('email')}</label>
              <input
                {...register('identifier')}
                autoComplete="username"
                placeholder="admin@boutique.com"
                className={darkField}
              />
              {errors.identifier && (
                <p className="mt-1.5 text-[11px] text-terracotta">{t('required')}</p>
              )}
            </div>
            <div>
              <label className={darkLabel}>{t('password')}</label>
              <input
                type="password"
                autoComplete="current-password"
                {...register('password')}
                placeholder="••••••••"
                className={darkField}
              />
              {errors.password && (
                <p className="mt-1.5 text-[11px] text-terracotta">{t('required')}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-900/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn size={16} />
              {t('login')}
            </button>
          </form>

          {/* The project answered neither yes nor no: it cannot be reached, or
              the SQL in `supabase/` has never been run against it. Saying so
              beats a form that would fail on submit. */}
          {dbError && (
            <div className="mt-7 flex items-start gap-2 border border-terracotta/40 bg-terracotta/10 px-3 py-2.5 text-[11px] leading-relaxed text-white/75">
              <AlertTriangle size={14} className="mt-px shrink-0 text-terracotta" />
              <span>
                {t('connectionError')}
                <span className="mt-1 block break-words font-mono text-[10px] text-white/45">
                  {dbError}
                </span>
              </span>
            </div>
          )}

          {/* First-run: the boutique has no owner yet */}
          <AnimatePresence initial={false}>
            {offerCreateAdmin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-7 border-t border-white/10 pt-6">
                  <p className="flex items-start gap-2 border border-white/15 bg-white/[0.04] px-3 py-2.5 text-[11px] leading-relaxed text-white/60">
                    <ShieldCheck size={14} className="mt-px shrink-0" />
                    {t('firstRunHint')}
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowCreate((v) => !v)}
                    className="mt-3 flex w-full items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white transition hover:opacity-70"
                  >
                    <UserPlus size={14} />
                    {t('createAdmin')}
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-300 ${showCreate ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <AnimatePresence>
                    {showCreate && (
                      <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={createForm.handleSubmit(onCreate)}
                        className="mt-4 space-y-3 overflow-hidden"
                      >
                        <div>
                          <label className={darkLabel}>{t('fullName')}</label>
                          <input {...createForm.register('fullName')} className={darkField} />
                          {createForm.formState.errors.fullName && (
                            <p className="mt-1 text-[11px] text-terracotta">{t('required')}</p>
                          )}
                        </div>
                        <div>
                          <label className={darkLabel}>{t('username')}</label>
                          <input {...createForm.register('username')} className={darkField} />
                          {createForm.formState.errors.username && (
                            <p className="mt-1 text-[11px] text-terracotta">{t('required')}</p>
                          )}
                        </div>
                        <div>
                          <label className={darkLabel}>{t('email')}</label>
                          <input
                            type="email"
                            {...createForm.register('email')}
                            className={darkField}
                          />
                          {createForm.formState.errors.email && (
                            <p className="mt-1 text-[11px] text-terracotta">{t('required')}</p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={darkLabel}>{t('password')}</label>
                            <input
                              type="password"
                              {...createForm.register('password')}
                              className={darkField}
                            />
                            {createForm.formState.errors.password && (
                              <p className="mt-1 text-[11px] text-terracotta">{t('required')}</p>
                            )}
                          </div>
                          <div>
                            <label className={darkLabel}>{t('confirmPassword')}</label>
                            <input
                              type="password"
                              {...createForm.register('confirm')}
                              className={darkField}
                            />
                            {createForm.formState.errors.confirm && (
                              <p className="mt-1 text-[11px] text-terracotta">
                                {createForm.formState.errors.confirm.message}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          type="submit"
                          size="lg"
                          disabled={busy}
                          className="w-full !bg-white !text-indigo-700"
                        >
                          <UserPlus size={16} />
                          {t('createMyAdmin')}
                        </Button>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
