import { create } from 'zustand'
import type { Expense } from '@/types'
import * as db from '@/lib/db'

/** `public.expenses`, cached for rendering and refreshed after every write. */
interface ExpenseState {
  expenses: Expense[]
  loading: boolean
  load: () => Promise<void>
  addExpense: (data: Pick<Expense, 'name' | 'description' | 'amount' | 'date'>) => Promise<Expense>
  updateExpense: (id: string, data: Partial<Expense>) => Promise<void>
  deleteExpense: (id: string) => Promise<void>
}

export const useExpenseStore = create<ExpenseState>()((set) => ({
  expenses: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      set({ expenses: await db.fetchExpenses() })
    } finally {
      set({ loading: false })
    }
  },

  addExpense: async (data) => {
    const expense = await db.createExpense(data)
    set((s) => ({ expenses: [expense, ...s.expenses] }))
    return expense
  },

  updateExpense: async (id, data) => {
    await db.updateExpense(id, data)
    set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...data } : e)) }))
  },

  deleteExpense: async (id) => {
    await db.deleteExpense(id)
    set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }))
  },
}))
