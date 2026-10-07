import { create } from 'zustand'
import type { Product, SizeCategory } from '@/types'
import { compareSizes } from '@/utils/helpers'
import * as db from '@/lib/db'

// ============================================================================
// Catalogue
// ----------------------------------------------------------------------------
// The list below is a cache of `public.products` and its child tables, filled
// by `load()` and refreshed after every write. It is never the source of the
// stock figure: an article's total is derived in the database from its size
// rows, and purchase and sale lines move it through triggers, so the client
// reads quantities rather than computing them.
// ============================================================================

interface ProductState {
  products: Product[]
  brands: string[]
  categories: string[]
  colors: string[]
  materials: string[]
  /** The boutique's size scales, per family. The user can extend any of them. */
  sizeScales: Record<SizeCategory, string[]>
  loading: boolean

  load: () => Promise<void>

  addProduct: (data: Partial<Product>) => Promise<Product>
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>

  addBrand: (name: string) => Promise<void>
  addCategory: (name: string) => Promise<void>
  addColor: (name: string) => Promise<void>
  addMaterial: (name: string) => Promise<void>
  /** Register a new size on a scale so it becomes selectable everywhere. */
  addSize: (category: SizeCategory, size: string) => Promise<void>
}

const EMPTY_SCALES: Record<SizeCategory, string[]> = {
  alpha: [],
  numeric: [],
  shoes: [],
  kids: [],
  oneSize: [],
  custom: [],
}

export const useProductStore = create<ProductState>()((set, get) => ({
  products: [],
  brands: [],
  categories: [],
  colors: [],
  materials: [],
  sizeScales: EMPTY_SCALES,
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const [products, lists] = await Promise.all([
        db.fetchProducts(),
        db.fetchReferenceLists(),
      ])
      set({
        products,
        brands: lists.brands,
        categories: lists.categories,
        colors: lists.colors,
        materials: lists.materials,
        sizeScales: lists.sizeScales,
      })
    } finally {
      set({ loading: false })
    }
  },

  addProduct: async (data) => {
    const product = await db.createProduct(data)
    set((s) => ({ products: [product, ...s.products] }))
    return product
  },

  updateProduct: async (id, data) => {
    const product = await db.updateProduct(id, data)
    set((s) => ({ products: s.products.map((p) => (p.id === id ? product : p)) }))
  },

  deleteProduct: async (id) => {
    await db.deleteProduct(id)
    set((s) => ({ products: s.products.filter((p) => p.id !== id) }))
  },

  addBrand: async (name) => {
    await db.addBrand(name)
    set((s) => (s.brands.includes(name) ? s : { brands: [...s.brands, name].sort() }))
  },

  addCategory: async (name) => {
    await db.addCategory(name)
    set((s) => (s.categories.includes(name) ? s : { categories: [...s.categories, name].sort() }))
  },

  addColor: async (name) => {
    await db.addColor(name)
    set((s) => (s.colors.includes(name) ? s : { colors: [...s.colors, name].sort() }))
  },

  addMaterial: async (name) => {
    await db.addMaterial(name)
    set((s) => (s.materials.includes(name) ? s : { materials: [...s.materials, name].sort() }))
  },

  addSize: async (category, size) => {
    if ((get().sizeScales[category] ?? []).includes(size)) return
    await db.addSizeToScale(category, size)
    set((s) => ({
      sizeScales: {
        ...s.sizeScales,
        [category]: [...(s.sizeScales[category] ?? []), size].sort(compareSizes),
      },
    }))
  },
}))
