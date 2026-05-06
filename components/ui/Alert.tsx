import { ReactNode } from 'react'
import { CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AlertProps {
  type?: 'success' | 'error' | 'info' | 'warning'
  children: ReactNode
  className?: string
}

const configs = {
  success: {
    wrapper: 'bg-green-50 border-green-200 text-green-800',
    Icon: CheckCircle,
    iconClass: 'text-green-600',
  },
  error: {
    wrapper: 'bg-red-50 border-red-200 text-red-800',
    Icon: XCircle,
    iconClass: 'text-red-600',
  },
  info: {
    wrapper: 'bg-blue-50 border-blue-200 text-blue-800',
    Icon: Info,
    iconClass: 'text-blue-600',
  },
  warning: {
    wrapper: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    Icon: AlertCircle,
    iconClass: 'text-yellow-600',
  },
}

export default function Alert({ type = 'info', children, className }: AlertProps) {
  const { wrapper, Icon, iconClass } = configs[type]
  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-xl border text-base', wrapper, className)}>
      <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', iconClass)} />
      <div>{children}</div>
    </div>
  )
}
