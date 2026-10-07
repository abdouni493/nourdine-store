import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react'
import { clsx } from '@/utils/clsx'

interface FieldProps {
  label?: ReactNode
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  ({ label, error, hint, className, id, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="label-wood">
          {label}
        </label>
      )}
      <input ref={ref} id={id} className={clsx('input-wood', error && 'border-terracotta', className)} {...props} />
      {error ? (
        <p className="mt-1 text-xs text-terracotta">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-wood-medium/60">{hint}</p>
      ) : null}
    </div>
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  ({ label, error, className, id, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="label-wood">
          {label}
        </label>
      )}
      <textarea ref={ref} id={id} rows={3} className={clsx('input-wood resize-none', error && 'border-terracotta', className)} {...props} />
      {error && <p className="mt-1 text-xs text-terracotta">{error}</p>}
    </div>
  ),
)
Textarea.displayName = 'Textarea'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldProps {
  children: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, id, children, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="label-wood">
          {label}
        </label>
      )}
      <select ref={ref} id={id} className={clsx('input-wood cursor-pointer', error && 'border-terracotta', className)} {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-terracotta">{error}</p>}
    </div>
  ),
)
Select.displayName = 'Select'
