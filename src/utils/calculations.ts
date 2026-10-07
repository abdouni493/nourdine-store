import type {
  Sale,
  Purchase,
  Worker,
  Expense,
  Product,
  CaisseTransaction,
  SizeCategory,
  WebOrder,
  WebOrderStatus,
} from '@/types'
import { round2, monthKey } from './helpers'
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  subMonths,
  format,
} from 'date-fns'

export const remaining = (total: number, paid: number): number => round2(Math.max(0, total - paid))

export interface PartyStats {
  totalAmount: number
  totalPaid: number
  totalDebt: number
  count: number
}

export const clientStats = (clientId: string, sales: Sale[]): PartyStats => {
  const list = sales.filter((s) => s.clientId === clientId)
  const totalAmount = round2(list.reduce((s, x) => s + x.total, 0))
  const totalPaid = round2(list.reduce((s, x) => s + x.paid, 0))
  return { totalAmount, totalPaid, totalDebt: remaining(totalAmount, totalPaid), count: list.length }
}

export const supplierStats = (supplierId: string, purchases: Purchase[]): PartyStats => {
  const list = purchases.filter((p) => p.supplierId === supplierId)
  const totalAmount = round2(list.reduce((s, x) => s + x.total, 0))
  const totalPaid = round2(list.reduce((s, x) => s + x.paid, 0))
  return { totalAmount, totalPaid, totalDebt: remaining(totalAmount, totalPaid), count: list.length }
}

const inRange = (dateStr: string, start: Date, end: Date): boolean => {
  const d = new Date(dateStr)
  return isWithinInterval(d, { start, end })
}

export const sumSales = (sales: Sale[], start: Date, end: Date): number =>
  round2(sales.filter((s) => inRange(s.date, start, end)).reduce((acc, s) => acc + s.total, 0))

export const sumPurchases = (purchases: Purchase[], start: Date, end: Date): number =>
  round2(purchases.filter((p) => inRange(p.date, start, end)).reduce((acc, p) => acc + p.total, 0))

export const sumExpenses = (expenses: Expense[], start: Date, end: Date): number =>
  round2(expenses.filter((e) => inRange(e.date, start, end)).reduce((acc, e) => acc + e.amount, 0))

export const sumSalaries = (workers: Worker[], start: Date, end: Date): number =>
  round2(
    workers.reduce(
      (acc, w) => acc + w.payments.filter((p) => inRange(p.date, start, end)).reduce((s, p) => s + p.amount, 0),
      0,
    ),
  )

// ----------------------------------------------------------------------------
// Caisse (Treasury / Cash register)
// ----------------------------------------------------------------------------

/** Sum the cash actually collected on sales whose date falls in range. */
export const sumSalesPaid = (sales: Sale[], start: Date, end: Date): number =>
  round2(sales.filter((s) => inRange(s.date, start, end)).reduce((acc, s) => acc + s.paid, 0))

/** Sum the cash actually disbursed on purchases whose date falls in range. */
export const sumPurchasesPaid = (purchases: Purchase[], start: Date, end: Date): number =>
  round2(purchases.filter((p) => inRange(p.date, start, end)).reduce((acc, p) => acc + p.paid, 0))

export const sumCaisse = (
  transactions: CaisseTransaction[],
  type: 'deposit' | 'withdrawal',
  start: Date,
  end: Date,
): number =>
  round2(
    transactions
      .filter((t) => t.type === type && inRange(t.date, start, end))
      .reduce((acc, t) => acc + t.amount, 0),
  )

export interface CaissePeriodStats {
  /** Total invoiced sales (billed). */
  salesTotal: number
  /** Cash collected from sales. */
  salesCollected: number
  /** Total invoiced purchases (billed). */
  purchasesTotal: number
  /** Cash disbursed for purchases. */
  purchasesPaid: number
  expenses: number
  salaries: number
  deposits: number
  withdrawals: number
  /** Money entering the caisse: sales collected + manual deposits. */
  cashIn: number
  /** Money leaving the caisse: purchases paid + expenses + salaries + withdrawals. */
  cashOut: number
  /** cashIn − cashOut. */
  netFlow: number
}

/** Aggregate every cash movement of the store over a date range. */
export const caissePeriodStats = (
  transactions: CaisseTransaction[],
  sales: Sale[],
  purchases: Purchase[],
  expenses: Expense[],
  workers: Worker[],
  start: Date,
  end: Date,
): CaissePeriodStats => {
  const salesTotal = sumSales(sales, start, end)
  const salesCollected = sumSalesPaid(sales, start, end)
  const purchasesTotal = sumPurchases(purchases, start, end)
  const purchasesPaid = sumPurchasesPaid(purchases, start, end)
  const expensesSum = sumExpenses(expenses, start, end)
  const salaries = sumSalaries(workers, start, end)
  const deposits = sumCaisse(transactions, 'deposit', start, end)
  const withdrawals = sumCaisse(transactions, 'withdrawal', start, end)
  const cashIn = round2(salesCollected + deposits)
  const cashOut = round2(purchasesPaid + expensesSum + salaries + withdrawals)
  return {
    salesTotal,
    salesCollected,
    purchasesTotal,
    purchasesPaid,
    expenses: expensesSum,
    salaries,
    deposits,
    withdrawals,
    cashIn,
    cashOut,
    netFlow: round2(cashIn - cashOut),
  }
}

export interface StoreWealth {
  /** All-time cash balance held in the caisse. */
  caisseBalance: number
  /** Purchase-cost value of everything currently in stock. */
  stockValue: number
  /** Money clients still owe the store. */
  clientReceivables: number
  /** Money the store still owes suppliers. */
  supplierPayables: number
  /** caisse + stock + receivables − payables. */
  totalWealth: number
}

const VERY_EARLY = new Date(0)
const VERY_LATE = new Date(8640000000000000)

/** Compute the global financial snapshot of the store (date-independent). */
export const storeWealth = (
  transactions: CaisseTransaction[],
  sales: Sale[],
  purchases: Purchase[],
  expenses: Expense[],
  workers: Worker[],
  products: Product[],
): StoreWealth => {
  const all = caissePeriodStats(transactions, sales, purchases, expenses, workers, VERY_EARLY, VERY_LATE)
  const caisseBalance = all.netFlow
  const stockValue = round2(products.reduce((s, p) => s + p.quantity * p.purchasePrice, 0))
  const clientReceivables = round2(sales.reduce((s, x) => s + Math.max(0, x.total - x.paid), 0))
  const supplierPayables = round2(purchases.reduce((s, x) => s + Math.max(0, x.total - x.paid), 0))
  return {
    caisseBalance,
    stockValue,
    clientReceivables,
    supplierPayables,
    totalWealth: round2(caisseBalance + stockValue + clientReceivables - supplierPayables),
  }
}

export interface DashboardStats {
  revenueToday: number
  revenueMonth: number
  productsInStock: number
  stockAlertCount: number
  purchasesMonth: number
  expensesMonth: number
  netProfit: number
  salariesMonth: number
}

export const dashboardStats = (
  sales: Sale[],
  purchases: Purchase[],
  expenses: Expense[],
  products: Product[],
  workers: Worker[],
): DashboardStats => {
  const now = new Date()
  const dayStart = startOfDay(now)
  const dayEnd = endOfDay(now)
  const monStart = startOfMonth(now)
  const monEnd = endOfMonth(now)

  const revenueMonth = sumSales(sales, monStart, monEnd)
  const purchasesMonth = sumPurchases(purchases, monStart, monEnd)
  const expensesMonth = sumExpenses(expenses, monStart, monEnd)
  const salariesMonth = sumSalaries(workers, monStart, monEnd)

  return {
    revenueToday: sumSales(sales, dayStart, dayEnd),
    revenueMonth,
    productsInStock: products.reduce((s, p) => s + p.quantity, 0),
    stockAlertCount: products.filter((p) => p.quantity <= p.minQuantity).length,
    purchasesMonth,
    expensesMonth,
    salariesMonth,
    netProfit: round2(revenueMonth - purchasesMonth - expensesMonth - salariesMonth),
  }
}

export interface MonthPoint {
  month: string
  sales: number
  purchases: number
  expenses: number
}

export const last12Months = (
  sales: Sale[],
  purchases: Purchase[],
  expenses: Expense[],
): MonthPoint[] => {
  const points: MonthPoint[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const ref = subMonths(now, i)
    const start = startOfMonth(ref)
    const end = endOfMonth(ref)
    points.push({
      month: format(ref, 'MMM yy'),
      sales: sumSales(sales, start, end),
      purchases: sumPurchases(purchases, start, end),
      expenses: sumExpenses(expenses, start, end),
    })
  }
  return points
}

export interface ProductSalesAgg {
  productId: string
  name: string
  quantity: number
  amount: number
}

export const topProducts = (sales: Sale[], limit = 5): ProductSalesAgg[] => {
  const map = new Map<string, ProductSalesAgg>()
  sales.forEach((sale) =>
    sale.lines.forEach((l) => {
      const cur = map.get(l.productId) ?? { productId: l.productId, name: l.productName, quantity: 0, amount: 0 }
      cur.quantity += l.quantity
      cur.amount += l.quantity * l.unitPrice
      map.set(l.productId, cur)
    }),
  )
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit)
}

// ----------------------------------------------------------------------------
// Per-product & per-category analytics (used by Caisse + Reports)
// ----------------------------------------------------------------------------

const productIndex = (products: Product[]): Map<string, Product> =>
  new Map(products.map((p) => [p.id, p]))

export interface ProductPurchaseAgg {
  productId: string
  name: string
  category: string
  quantity: number
  total: number
}

/** Aggregate every purchase LINE whose purchase falls in range, grouped by product. */
export const periodPurchasedProducts = (
  purchases: Purchase[],
  products: Product[],
  start: Date,
  end: Date,
): ProductPurchaseAgg[] => {
  const idx = productIndex(products)
  const map = new Map<string, ProductPurchaseAgg>()
  purchases
    .filter((p) => inRange(p.date, start, end))
    .forEach((p) =>
      p.lines.forEach((l) => {
        const cur =
          map.get(l.productId) ??
          { productId: l.productId, name: l.productName, category: idx.get(l.productId)?.category ?? '—', quantity: 0, total: 0 }
        cur.quantity += l.quantity
        cur.total = round2(cur.total + l.quantity * l.purchasePrice)
        map.set(l.productId, cur)
      }),
    )
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export interface ProductSaleAgg {
  productId: string
  name: string
  category: string
  quantity: number
  revenue: number
  cost: number
  gain: number
}

/** Aggregate every sale LINE whose sale falls in range, grouped by product (with margin). */
export const periodSoldProducts = (
  sales: Sale[],
  products: Product[],
  start: Date,
  end: Date,
): ProductSaleAgg[] => {
  const idx = productIndex(products)
  const map = new Map<string, ProductSaleAgg>()
  sales
    .filter((s) => inRange(s.date, start, end))
    .forEach((s) =>
      s.lines.forEach((l) => {
        const prod = idx.get(l.productId)
        const cur =
          map.get(l.productId) ??
          { productId: l.productId, name: l.productName, category: prod?.category ?? '—', quantity: 0, revenue: 0, cost: 0, gain: 0 }
        const lineRevenue = l.quantity * l.unitPrice
        const lineCost = l.quantity * (prod?.purchasePrice ?? 0)
        cur.quantity += l.quantity
        cur.revenue = round2(cur.revenue + lineRevenue)
        cur.cost = round2(cur.cost + lineCost)
        cur.gain = round2(cur.revenue - cur.cost)
        map.set(l.productId, cur)
      }),
    )
  return [...map.values()].sort((a, b) => b.quantity - a.quantity)
}

/**
 * Velocity table over a period: EVERY product, including those never sold,
 * sorted by quantity sold. Lets a view slice fast movers (top) and slow / dead
 * stock (bottom) from one list.
 */
export const productSalesAnalysis = (
  sales: Sale[],
  products: Product[],
  start: Date,
  end: Date,
): ProductSaleAgg[] => {
  const sold = new Map(periodSoldProducts(sales, products, start, end).map((r) => [r.productId, r]))
  return products
    .map(
      (p) =>
        sold.get(p.id) ?? {
          productId: p.id,
          name: p.name,
          category: p.category,
          quantity: 0,
          revenue: 0,
          cost: 0,
          gain: 0,
        },
    )
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
}

export interface CategoryAgg {
  category: string
  qtySold: number
  salesRevenue: number
  salesCost: number
  gain: number
  qtyPurchased: number
  purchasesCost: number
}

/** Per-category sales, purchases and realised gain over a date range. */
export const categoryBreakdown = (
  sales: Sale[],
  purchases: Purchase[],
  products: Product[],
  start: Date,
  end: Date,
): CategoryAgg[] => {
  const map = new Map<string, CategoryAgg>()
  const blank = (category: string): CategoryAgg => ({
    category,
    qtySold: 0,
    salesRevenue: 0,
    salesCost: 0,
    gain: 0,
    qtyPurchased: 0,
    purchasesCost: 0,
  })

  periodSoldProducts(sales, products, start, end).forEach((r) => {
    const cur = map.get(r.category) ?? blank(r.category)
    cur.qtySold += r.quantity
    cur.salesRevenue = round2(cur.salesRevenue + r.revenue)
    cur.salesCost = round2(cur.salesCost + r.cost)
    cur.gain = round2(cur.salesRevenue - cur.salesCost)
    map.set(r.category, cur)
  })

  periodPurchasedProducts(purchases, products, start, end).forEach((r) => {
    const cur = map.get(r.category) ?? blank(r.category)
    cur.qtyPurchased += r.quantity
    cur.purchasesCost = round2(cur.purchasesCost + r.total)
    map.set(r.category, cur)
  })

  return [...map.values()].sort((a, b) => b.salesRevenue - a.salesRevenue)
}

// ----------------------------------------------------------------------------
// Size analytics — the clothing-specific reporting layer
// ----------------------------------------------------------------------------

export interface SizeAgg {
  /** The size label, e.g. 'M' or '42'. */
  size: string
  /** The family it belongs to, so a '42' shoe never merges with a '42' trouser. */
  sizeCategory: SizeCategory
  quantity: number
  revenue: number
  cost: number
  gain: number
}

/** Units and revenue per individual size sold over a period. */
export const periodSizeSales = (
  sales: Sale[],
  products: Product[],
  start: Date,
  end: Date,
): SizeAgg[] => {
  const idx = productIndex(products)
  const map = new Map<string, SizeAgg>()
  sales
    .filter((s) => inRange(s.date, start, end))
    .forEach((s) =>
      s.lines.forEach((l) => {
        const prod = idx.get(l.productId)
        const sizeCategory: SizeCategory = prod?.sizeCategory ?? 'custom'
        const size = l.size || '—'
        // Key on family + label: a 42 shoe and a 42 trouser are different sizes.
        const key = `${sizeCategory}::${size}`
        const cur =
          map.get(key) ?? { size, sizeCategory, quantity: 0, revenue: 0, cost: 0, gain: 0 }
        cur.quantity += l.quantity
        cur.revenue = round2(cur.revenue + l.quantity * l.unitPrice)
        cur.cost = round2(cur.cost + l.quantity * (prod?.purchasePrice ?? 0))
        cur.gain = round2(cur.revenue - cur.cost)
        map.set(key, cur)
      }),
    )
  return [...map.values()].sort((a, b) => b.quantity - a.quantity)
}

export interface SizeCategoryAgg {
  sizeCategory: SizeCategory
  quantity: number
  revenue: number
  gain: number
  /** Sizes within this family, best-selling first. */
  sizes: SizeAgg[]
}

/** Roll individual sizes up into their families (alpha, numeric, shoes, kids…). */
export const sizeCategoryBreakdown = (
  sales: Sale[],
  products: Product[],
  start: Date,
  end: Date,
): SizeCategoryAgg[] => {
  const map = new Map<SizeCategory, SizeCategoryAgg>()
  periodSizeSales(sales, products, start, end).forEach((r) => {
    const cur =
      map.get(r.sizeCategory) ??
      { sizeCategory: r.sizeCategory, quantity: 0, revenue: 0, gain: 0, sizes: [] }
    cur.quantity += r.quantity
    cur.revenue = round2(cur.revenue + r.revenue)
    cur.gain = round2(cur.gain + r.gain)
    cur.sizes.push(r)
    map.set(r.sizeCategory, cur)
  })
  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
}

/** Stock currently held, per size family — pairs with the sales view above. */
export const stockBySizeCategory = (
  products: Product[],
): { sizeCategory: SizeCategory; units: number; value: number }[] => {
  const map = new Map<SizeCategory, { sizeCategory: SizeCategory; units: number; value: number }>()
  products.forEach((p) => {
    const cur = map.get(p.sizeCategory) ?? { sizeCategory: p.sizeCategory, units: 0, value: 0 }
    cur.units += p.quantity
    cur.value = round2(cur.value + p.quantity * p.purchasePrice)
    map.set(p.sizeCategory, cur)
  })
  return [...map.values()].sort((a, b) => b.units - a.units)
}

/** Articles with a size in rupture while the article itself is still sellable. */
export const productsWithMissingSizes = (
  products: Product[],
): { product: Product; missing: string[] }[] =>
  products
    .filter((p) => p.sizes.length > 0 && p.quantity > 0)
    .map((p) => ({ product: p, missing: p.sizes.filter((s) => s.quantity <= 0).map((s) => s.size) }))
    .filter((r) => r.missing.length > 0)

/** Group sales by any product attribute — used for the gender & season splits. */
export const attributeBreakdown = <K extends 'gender' | 'season'>(
  sales: Sale[],
  products: Product[],
  attribute: K,
  start: Date,
  end: Date,
): { key: Product[K]; quantity: number; revenue: number }[] => {
  const idx = productIndex(products)
  const map = new Map<Product[K], { key: Product[K]; quantity: number; revenue: number }>()
  sales
    .filter((s) => inRange(s.date, start, end))
    .forEach((s) =>
      s.lines.forEach((l) => {
        const prod = idx.get(l.productId)
        if (!prod) return
        const k = prod[attribute]
        const cur = map.get(k) ?? { key: k, quantity: 0, revenue: 0 }
        cur.quantity += l.quantity
        cur.revenue = round2(cur.revenue + l.quantity * l.unitPrice)
        map.set(k, cur)
      }),
    )
  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
}

// ----------------------------------------------------------------------------
// Worker cash movements (advances / payments / absences) over a period
// ----------------------------------------------------------------------------

export interface WorkerMovement {
  id: string
  workerId: string
  workerName: string
  role: string
  date: string
  description: string
  amount: number
}

export interface PeriodWorkerMovements {
  advances: WorkerMovement[]
  payments: WorkerMovement[]
  absences: WorkerMovement[]
  totalAdvances: number
  totalPayments: number
  totalAbsences: number
}

export const periodWorkerMovements = (
  workers: Worker[],
  start: Date,
  end: Date,
): PeriodWorkerMovements => {
  const advances: WorkerMovement[] = []
  const payments: WorkerMovement[] = []
  const absences: WorkerMovement[] = []
  workers.forEach((w) => {
    w.advances
      .filter((a) => inRange(a.date, start, end))
      .forEach((a) =>
        advances.push({ id: a.id, workerId: w.id, workerName: w.fullName, role: w.role, date: a.date, description: a.description, amount: a.amount }),
      )
    w.payments
      .filter((p) => inRange(p.date, start, end))
      .forEach((p) =>
        payments.push({ id: p.id, workerId: w.id, workerName: w.fullName, role: w.role, date: p.date, description: p.note ?? p.period, amount: p.amount }),
      )
    w.absences
      .filter((a) => inRange(a.date, start, end))
      .forEach((a) =>
        absences.push({ id: a.id, workerId: w.id, workerName: w.fullName, role: w.role, date: a.date, description: a.description, amount: a.cost }),
      )
  })
  const sortDesc = (a: WorkerMovement, b: WorkerMovement) => +new Date(b.date) - +new Date(a.date)
  advances.sort(sortDesc)
  payments.sort(sortDesc)
  absences.sort(sortDesc)
  return {
    advances,
    payments,
    absences,
    totalAdvances: round2(advances.reduce((s, x) => s + x.amount, 0)),
    totalPayments: round2(payments.reduce((s, x) => s + x.amount, 0)),
    totalAbsences: round2(absences.reduce((s, x) => s + x.amount, 0)),
  }
}

export interface ClientAgg {
  clientId: string
  name: string
  amount: number
}

export const topClients = (sales: Sale[], limit = 5): ClientAgg[] => {
  const map = new Map<string, ClientAgg>()
  sales.forEach((s) => {
    if (!s.clientId) return
    const cur = map.get(s.clientId) ?? { clientId: s.clientId, name: s.clientName, amount: 0 }
    cur.amount += s.total
    map.set(s.clientId, cur)
  })
  return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, limit)
}

/** Compute a worker's payable salary for a given month key (YYYY-MM). */
export const computeSalary = (worker: Worker, period: string) => {
  const base =
    worker.salaryType === 'monthly' ? worker.salaryAmount : worker.salaryAmount * 26 // ~26 working days
  const absences = round2(
    worker.absences.filter((a) => monthKey(a.date) === period).reduce((s, a) => s + a.cost, 0),
  )
  const advances = round2(worker.advances.filter((a) => !a.deducted).reduce((s, a) => s + a.amount, 0))
  const toPay = round2(Math.max(0, base - absences - advances))
  return { base, absences, advances, toPay }
}

// ----------------------------------------------------------------------------
// Website channel — the online store's own analytics
// ----------------------------------------------------------------------------

export interface WebChannelStats {
  /** Orders placed in the period, whatever became of them. */
  placed: number
  pending: number
  accepted: number
  delivered: number
  completed: number
  canceled: number
  returned: number
  /** Billed value of every order placed in the period. */
  grossValue: number
  /** Value of orders that reached `completed` — the money actually collected. */
  netRevenue: number
  /** Carrier fees inside `netRevenue`. */
  deliveryCollected: number
  /** Units that left the boutique through the website. */
  unitsSold: number
  /** netRevenue ÷ completed. */
  avgOrderValue: number
  /** completed ÷ placed, as a percentage. */
  fulfillmentRate: number
  cancelRate: number
  returnRate: number
}

const orderInRange = (o: WebOrder, start: Date, end: Date): boolean =>
  isWithinInterval(new Date(o.createdAt), { start, end })

/** Aggregate the online channel over a date range. */
export const webChannelStats = (
  orders: WebOrder[],
  start: Date,
  end: Date,
): WebChannelStats => {
  const period = orders.filter((o) => orderInRange(o, start, end))
  const by = (s: WebOrderStatus) => period.filter((o) => o.status === s)

  const completed = by('completed')
  const netRevenue = round2(completed.reduce((s, o) => s + o.total, 0))
  const placed = period.length

  // Only fulfilled orders moved stock, so only they count units sold.
  const unitsSold = completed.reduce(
    (n, o) => n + o.lines.reduce((k, l) => k + l.quantity, 0),
    0,
  )

  const pct = (n: number) => (placed > 0 ? round2((n / placed) * 100) : 0)

  return {
    placed,
    pending: by('pending').length,
    accepted: by('accepted').length,
    delivered: by('delivered').length,
    completed: completed.length,
    canceled: by('canceled').length,
    returned: by('returned').length,
    grossValue: round2(period.reduce((s, o) => s + o.total, 0)),
    netRevenue,
    deliveryCollected: round2(completed.reduce((s, o) => s + o.deliveryPrice, 0)),
    unitsSold,
    avgOrderValue: completed.length > 0 ? round2(netRevenue / completed.length) : 0,
    fulfillmentRate: pct(completed.length),
    cancelRate: pct(by('canceled').length),
    returnRate: pct(by('returned').length),
  }
}

export interface WilayaAgg {
  wilaya: string
  orders: number
  revenue: number
  units: number
}

/** Where the online orders come from, best-performing wilaya first. */
export const webOrdersByWilaya = (
  orders: WebOrder[],
  start: Date,
  end: Date,
): WilayaAgg[] => {
  const map = new Map<string, WilayaAgg>()
  orders
    .filter((o) => orderInRange(o, start, end) && o.status !== 'canceled')
    .forEach((o) => {
      const key = `${o.wilayaCode} — ${o.wilaya}`
      const cur = map.get(key) ?? { wilaya: key, orders: 0, revenue: 0, units: 0 }
      cur.orders += 1
      cur.revenue = round2(cur.revenue + o.total)
      cur.units += o.lines.reduce((n, l) => n + l.quantity, 0)
      map.set(key, cur)
    })
  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
}

export interface WebProductAgg {
  productId: string
  name: string
  quantity: number
  revenue: number
}

/** The articles the website actually shifts. */
export const webTopProducts = (
  orders: WebOrder[],
  start: Date,
  end: Date,
  limit = 10,
): WebProductAgg[] => {
  const map = new Map<string, WebProductAgg>()
  orders
    .filter((o) => orderInRange(o, start, end) && o.status !== 'canceled')
    .forEach((o) =>
      o.lines.forEach((l) => {
        const cur =
          map.get(l.productId) ?? { productId: l.productId, name: l.productName, quantity: 0, revenue: 0 }
        cur.quantity += l.quantity
        cur.revenue = round2(cur.revenue + l.quantity * l.unitPrice)
        map.set(l.productId, cur)
      }),
    )
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit)
}

export interface OfferPerformance {
  offerId: string
  title: string
  orders: number
  units: number
  revenue: number
}

/** How each campaign converted, measured on the orders that quoted it. */
export const offerPerformance = (
  orders: WebOrder[],
  start: Date,
  end: Date,
): OfferPerformance[] => {
  const map = new Map<string, OfferPerformance>()
  orders
    .filter((o) => orderInRange(o, start, end) && o.status !== 'canceled')
    .forEach((o) => {
      // One order may quote several campaigns; each is credited once for it.
      const seen = new Set<string>()
      o.lines.forEach((l) => {
        if (!l.offerId) return
        const cur =
          map.get(l.offerId) ??
          { offerId: l.offerId, title: l.offerTitle ?? l.offerId, orders: 0, units: 0, revenue: 0 }
        if (!seen.has(l.offerId)) {
          cur.orders += 1
          seen.add(l.offerId)
        }
        cur.units += l.quantity
        cur.revenue = round2(cur.revenue + l.quantity * l.unitPrice)
        map.set(l.offerId, cur)
      })
    })
  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
}

/** Day-by-day online revenue for the period's trend line. */
export const webDailyRevenue = (
  orders: WebOrder[],
  start: Date,
  end: Date,
): { day: string; orders: number; revenue: number }[] => {
  const map = new Map<string, { day: string; orders: number; revenue: number }>()
  orders
    .filter((o) => orderInRange(o, start, end))
    .forEach((o) => {
      const day = format(new Date(o.createdAt), 'dd/MM')
      const cur = map.get(day) ?? { day, orders: 0, revenue: 0 }
      cur.orders += 1
      if (o.status === 'completed') cur.revenue = round2(cur.revenue + o.total)
      map.set(day, cur)
    })
  return [...map.values()]
}
