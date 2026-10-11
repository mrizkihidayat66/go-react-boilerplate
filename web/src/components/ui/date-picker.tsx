// Lightweight date picker: a Popover housing a native <input type="date">
// styled to match the design system. Avoids a heavy calendar dependency
// while still demonstrating the popover + controlled-input pattern.

import { CalendarDays } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value?: string // ISO date string (YYYY-MM-DD)
  onChange?: (date: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const formatted = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarDays className="mr-2 size-4" />
          {formatted ?? placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <Input
          type="date"
          value={value ?? ''}
          onChange={(e) => {
            onChange?.(e.target.value)
            if (e.target.value) setOpen(false)
          }}
          className="w-auto"
        />
      </PopoverContent>
    </Popover>
  )
}
