import { forwardRef } from 'react'
import type { Sale, Purchase, StoreSettings } from '@/types'
import { formatMoney } from '@/utils/helpers'
import { remaining } from '@/utils/calculations'
import { format } from 'date-fns'

interface InvoicePrintProps {
  doc: Sale | Purchase
  settings: StoreSettings
  kind: 'sale' | 'purchase'
}

const isSale = (doc: Sale | Purchase): doc is Sale => 'clientName' in doc

export const InvoicePrint = forwardRef<HTMLDivElement, InvoicePrintProps>(({ doc, settings, kind }, ref) => {
  const sale = isSale(doc)
  const lines = doc.lines
  const rest = remaining(doc.total, doc.paid)

  return (
    <div ref={ref} className="print-area mx-auto max-w-[800px] bg-white p-10 text-charcoal" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-gold pb-5">
        <div className="flex items-center gap-3">
          {settings.logo ? (
            <img src={settings.logo} alt="logo" className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-wood-btn text-2xl font-bold text-accentfg">
              {settings.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-wood-dark" style={{ fontFamily: 'Playfair Display, serif' }}>
              {settings.name}
            </h1>
            <p className="text-xs text-wood-medium">{settings.description}</p>
            <p className="text-xs text-wood-medium">{settings.address}</p>
            <p className="text-xs text-wood-medium">
              {settings.phone} · {settings.email}
            </p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold uppercase tracking-wide text-goldink">
            {kind === 'sale' ? 'Facture de Vente' : "Facture d'Achat"}
          </h2>
          <p className="mt-1 text-sm font-semibold">{doc.reference}</p>
          <p className="text-xs text-wood-medium">{format(new Date(doc.date), 'dd/MM/yyyy')}</p>
        </div>
      </div>

      {/* Party */}
      <div className="mt-6 rounded-lg bg-wood-cream/50 p-4">
        <p className="text-xs font-semibold uppercase text-wood-medium">{sale ? 'Client' : 'Fournisseur'}</p>
        <p className="text-base font-bold text-wood-dark">{sale ? (doc as Sale).clientName : (doc as Purchase).supplierName}</p>
      </div>

      {/* Lines */}
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gold text-left text-xs uppercase text-wood-medium">
            <th className="py-2">Désignation</th>
            <th className="py-2 text-center">Taille</th>
            <th className="py-2 text-center">Qté</th>
            <th className="py-2 text-right">Prix unitaire</th>
            <th className="py-2 text-right">Sous-total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const unit = sale ? (l as Sale['lines'][number]).unitPrice : (l as Purchase['lines'][number]).purchasePrice
            return (
              <tr key={i} className="border-b border-wood-cream">
                <td className="py-2 font-medium">{l.productName}</td>
                <td className="py-2 text-center font-semibold">{l.size || '—'}</td>
                <td className="py-2 text-center">{l.quantity}</td>
                <td className="py-2 text-right" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {formatMoney(unit, settings.currency)}
                </td>
                <td className="py-2 text-right font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {formatMoney(l.quantity * unit, settings.currency)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-6 flex justify-end">
        <div className="w-72 space-y-1.5 text-sm">
          {sale && (doc as Sale).discount > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-wood-medium">Sous-total</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney((doc as Sale).subtotal, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-terracotta">
                <span>Réduction</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>- {formatMoney((doc as Sale).discount, settings.currency)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-gold pt-2 text-base font-bold text-wood-dark">
            <span>Total</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(doc.total, settings.currency)}</span>
          </div>
          <div className="flex justify-between text-sage">
            <span>Payé</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(doc.paid, settings.currency)}</span>
          </div>
          <div className="flex justify-between font-semibold text-terracotta">
            <span>Reste dû</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(rest, settings.currency)}</span>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="mt-12 flex justify-between text-sm">
        <div className="text-center">
          <div className="mb-1 h-12 w-44 border-b border-wood-medium" />
          <span className="text-xs text-wood-medium">{sale ? 'Client' : 'Fournisseur'}</span>
        </div>
        <div className="text-center">
          <div className="mb-1 h-12 w-44 border-b border-wood-medium" />
          <span className="text-xs text-wood-medium">Le Gérant</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-10 border-t border-wood-cream pt-4 text-center text-[10px] text-wood-medium">
        <p>
          NIF: {settings.nif} · NIS: {settings.nis} · Art: {settings.article} · RC: {settings.rc}
        </p>
        <p className="mt-1">Merci de votre confiance — {settings.name}</p>
      </div>
    </div>
  )
})
InvoicePrint.displayName = 'InvoicePrint'
