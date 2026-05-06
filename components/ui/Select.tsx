import { SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-base font-semibold text-gray-700">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'w-full px-4 py-3 text-lg border rounded-xl transition-colors bg-white',
            'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400',
            error
              ? 'border-red-400 bg-red-50'
              : 'border-gray-300 hover:border-gray-400',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-sm text-red-600 font-medium">{error}</p>
        )}
      </div>
    )
  }
)
Select.displayName = 'Select'

export default Select
