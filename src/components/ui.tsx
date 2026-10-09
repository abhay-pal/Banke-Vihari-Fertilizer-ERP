import * as React from 'react'
import { createContext, useContext, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'

const buttonVariants = cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 active:translate-y-px', {
  variants: {
    variant: {
      default: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
      outline: 'border border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
      ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
      secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-200',
      danger: 'bg-rose-600 text-white hover:bg-rose-700',
      link: 'text-brand-700 underline-offset-4 hover:underline',
    },
    size: { default: 'h-10 px-4 py-2', sm: 'h-8 rounded-lg px-3 text-xs', lg: 'h-12 rounded-xl px-5 text-sm', icon: 'h-10 w-10', 'icon-sm': 'h-8 w-8 rounded-lg' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => {
  return <input ref={ref} className={cn('h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-brand-900', className)} {...props} />
})
Input.displayName = 'Input'
export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('min-h-[92px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100', className)} {...props} />
}
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100', className)} {...props}>{children}</select>
}
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300', className)} {...props} />
}
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('panel', className)} {...props} /> }
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)} {...props} /> }
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) { return <h3 className={cn('text-sm font-semibold text-slate-800 dark:text-slate-100', className)} {...props} /> }
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('px-5 pb-5 pt-4', className)} {...props} /> }
export function Badge({ className, tone = 'gray', ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'green' | 'amber' | 'red' | 'blue' | 'gray' }) {
  const tones = { green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300', red: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300', blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300', gray: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' }
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold', tones[tone], className)} {...props} />
}

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (v: boolean) => void; children: React.ReactNode }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out" /><DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl outline-none dark:border-slate-700 dark:bg-[#17231d]">{children}</DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>
}
export function DialogHeader({ title, description, onClose, className }: { title: string; description?: string; onClose?: () => void; className?: string }) {
  return <div className={cn('flex items-start justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800', className)}><div><DialogPrimitive.Title className="text-lg font-semibold text-slate-900 dark:text-white">{title}</DialogPrimitive.Title>{description && <DialogPrimitive.Description className="mt-1 text-sm text-slate-500">{description}</DialogPrimitive.Description>}</div><DialogPrimitive.Close onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18}/></DialogPrimitive.Close></div>
}

export type ToastMessage = { id: number; title: string; description?: string; type: 'success' | 'error' | 'info' }
const ToastContext = createContext<{ toast: (title: string, description?: string, type?: ToastMessage['type']) => void } | null>(null)
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([])
  const toast = (title: string, description?: string, type: ToastMessage['type'] = 'success') => {
    const id = Date.now() + Math.random()
    setMessages(old => [...old, { id, title, description, type }])
    window.setTimeout(() => setMessages(old => old.filter(m => m.id !== id)), 4200)
  }
  return <ToastContext.Provider value={{ toast }}>{children}<div className="fixed bottom-5 right-5 z-[100] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">{messages.map(m => <div key={m.id} className={cn('rounded-2xl border bg-white p-4 shadow-xl dark:bg-slate-900', m.type === 'error' ? 'border-rose-200' : m.type === 'success' ? 'border-emerald-200' : 'border-blue-200')}><div className={cn('text-sm font-semibold', m.type === 'error' ? 'text-rose-700' : m.type === 'success' ? 'text-emerald-700' : 'text-blue-700')}>{m.title}</div>{m.description && <div className="mt-1 text-xs text-slate-500">{m.description}</div>}</div>)}</div></ToastContext.Provider>
}
export function useToast() { const value = useContext(ToastContext); if (!value) throw new Error('useToast must be inside ToastProvider'); return value }

export function Spinner({ className }: { className?: string }) { return <span className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} /> }
export function EmptyState({ title = 'Nothing here yet', description = 'Add a record to get started.', icon }: { title?: string; description?: string; icon?: React.ReactNode }) {
  return <div className="flex flex-col items-center justify-center px-6 py-14 text-center">{icon && <div className="mb-3 text-slate-300">{icon}</div>}<p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">{description}</p></div>
}
export function LoadingState({ label = 'Loading records…' }: { label?: string }) { return <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400"><Spinner/>{label}</div> }
