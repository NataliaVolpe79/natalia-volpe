import { TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-base font-semibold text-gray-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          rows={3}
          className={cn(
            'w-full px-4 py-3 text-lg border rounded-xl transition-colors resize-none',
            'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400',
            'placeholder:text-gray-400',
            error
              ? 'border-red-400 bg-red-50'
              : 'border-gray-300 bg-white hover:border-gray-400',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-600 font-medium">{error}</p>
        )}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export default Textarea
