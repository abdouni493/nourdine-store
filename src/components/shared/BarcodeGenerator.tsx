import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface BarcodeProps {
  value: string
  productName?: string
  width?: number
  height?: number
  displayValue?: boolean
}

export const Barcode = ({ value, width = 2, height = 60, displayValue = true }: BarcodeProps) => {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, value, {
          format: value.length === 13 ? 'EAN13' : 'CODE128',
          width,
          height,
          displayValue,
          fontSize: 14,
          margin: 6,
          background: '#ffffff',
          lineColor: '#2C2218',
        })
      } catch {
        // fallback to CODE128 for any invalid EAN
        try {
          JsBarcode(ref.current, value, { format: 'CODE128', width, height, displayValue })
        } catch {
          /* ignore */
        }
      }
    }
  }, [value, width, height, displayValue])

  return <svg ref={ref} />
}
