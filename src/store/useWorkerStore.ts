import { create } from 'zustand'
import type { Permissions, Worker, WorkerAbsence, WorkerAdvance, WorkerPayment } from '@/types'
import * as db from '@/lib/db'
import { provisionWorkerAccount } from '@/lib/supabase'

// ============================================================================
// Staff
// ----------------------------------------------------------------------------
// A worker is a row in `public.workers` carrying their permission matrix. The
// account itself, when they have one, is a Supabase `auth.users` record: the
// worker row never stores a password, and `sync_worker_profile()` copies a
// changed matrix onto the profile so revoking a module takes effect on their
// next request rather than only in the interface that drew it.
// ============================================================================

interface WorkerState {
  workers: Worker[]
  roles: string[]
  loading: boolean
  load: () => Promise<void>

  addWorker: (data: Partial<Worker>) => Promise<Worker>
  updateWorker: (id: string, data: Partial<Worker>) => Promise<void>
  deleteWorker: (id: string) => Promise<void>
  setPermissions: (id: string, permissions: Permissions) => Promise<void>
  addRole: (name: string) => Promise<void>

  addAdvance: (workerId: string, advance: Omit<WorkerAdvance, 'id' | 'deducted'>) => Promise<void>
  addAbsence: (workerId: string, absence: Omit<WorkerAbsence, 'id'>) => Promise<void>
  addPayment: (workerId: string, payment: Omit<WorkerPayment, 'id'>) => Promise<void>

  /**
   * Give a worker a sign-in. Creates the `auth.users` record on an isolated
   * client so the owner keeps their own session, and lets the `handle_new_user`
   * trigger write the profile and flip `has_account`.
   */
  createAccount: (
    workerId: string,
    credentials: { email: string; password: string; username: string },
  ) => Promise<{ ok: boolean; message?: string }>
}

export const useWorkerStore = create<WorkerState>()((set, get) => ({
  workers: [],
  roles: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const [workers, lists] = await Promise.all([db.fetchWorkers(), db.fetchReferenceLists()])
      set({ workers, roles: lists.roles })
    } finally {
      set({ loading: false })
    }
  },

  addWorker: async (data) => {
    const worker = await db.createWorker(data)
    set((s) => ({ workers: [worker, ...s.workers] }))
    return worker
  },

  updateWorker: async (id, data) => {
    const worker = await db.updateWorker(id, data)
    set((s) => ({ workers: s.workers.map((w) => (w.id === id ? worker : w)) }))
  },

  deleteWorker: async (id) => {
    await db.deleteWorker(id)
    set((s) => ({ workers: s.workers.filter((w) => w.id !== id) }))
  },

  setPermissions: async (id, permissions) => {
    const worker = await db.updateWorker(id, { permissions })
    set((s) => ({ workers: s.workers.map((w) => (w.id === id ? worker : w)) }))
  },

  addRole: async (name) => {
    await db.addRole(name)
    set((s) => (s.roles.includes(name) ? s : { roles: [...s.roles, name].sort() }))
  },

  addAdvance: async (workerId, advance) => {
    const worker = await db.addWorkerAdvance(workerId, {
      description: advance.description,
      amount: advance.amount,
      date: advance.date,
    })
    set((s) => ({ workers: s.workers.map((w) => (w.id === workerId ? worker : w)) }))
  },

  addAbsence: async (workerId, absence) => {
    const worker = await db.addWorkerAbsence(workerId, {
      description: absence.description,
      cost: absence.cost,
      date: absence.date,
    })
    set((s) => ({ workers: s.workers.map((w) => (w.id === workerId ? worker : w)) }))
  },

  addPayment: async (workerId, payment) => {
    const worker = await db.addWorkerPayment(workerId, {
      period: payment.period,
      baseSalary: payment.baseSalary,
      absencesDeducted: payment.absencesDeducted,
      advancesDeducted: payment.advancesDeducted,
      amount: payment.amount,
      date: payment.date,
      note: payment.note,
    })
    set((s) => ({ workers: s.workers.map((w) => (w.id === workerId ? worker : w)) }))
  },

  createAccount: async (workerId, credentials) => {
    const worker = get().workers.find((w) => w.id === workerId)
    if (!worker) return { ok: false, message: 'worker-not-found' }

    const result = await provisionWorkerAccount({
      email: credentials.email,
      password: credentials.password,
      fullName: worker.fullName,
      username: credentials.username,
      workerId,
      role: worker.role,
    })
    if (!result.ok) return result

    // The trigger set `has_account` and `profile_id`; record the address the
    // worker now signs in with, then read the staff list back.
    await db.updateWorker(workerId, {
      email: credentials.email,
      username: credentials.username,
      hasAccount: true,
    })
    set({ workers: await db.fetchWorkers() })
    return { ok: true }
  },
}))
