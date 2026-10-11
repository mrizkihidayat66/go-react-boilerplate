// Common webapp mechanisms, each as a small working example: local
// state and reducers, full CRUD, chain-reaction between components,
// custom events, DOM access via refs, and composition/variant styling.
// Route: /patterns (any authenticated user).

import { cva } from 'class-variance-authority'
import {
  ArrowRight,
  BadgeCheck,
  Focus,
  MousePointerClick,
  Plus,
  RefreshCw,
  Ruler,
  Trash2,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Grid, GridItem } from '@/components/ui/grid'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useDocumentTitle } from '@/lib/use-document-title'
import { cn } from '@/lib/utils'

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------
// 1. State + CRUD — a todo list held in a reducer, with derived counts.
// ---------------------------------------------------------------------

interface Todo {
  id: number
  text: string
  done: boolean
}

type TodoAction =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: number }
  | { type: 'rename'; id: number; text: string }
  | { type: 'remove'; id: number }

function todoReducer(state: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case 'add':
      return [...state, { id: Date.now(), text: action.text, done: false }]
    case 'toggle':
      return state.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t))
    case 'rename':
      return state.map((t) => (t.id === action.id ? { ...t, text: action.text } : t))
    case 'remove':
      return state.filter((t) => t.id !== action.id)
  }
}

function CrudDemo() {
  const [todos, dispatch] = useReducer(todoReducer, [
    { id: 1, text: 'Read the architecture doc', done: true },
    { id: 2, text: 'Add a new page', done: false },
  ])
  const [text, setText] = useState('')

  // Derived state: computed from `todos`, never stored separately.
  const { total, done } = useMemo(
    () => ({ total: todos.length, done: todos.filter((t) => t.done).length }),
    [todos],
  )

  const add = () => {
    const value = text.trim()
    if (!value) return
    dispatch({ type: 'add', text: value })
    setText('')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="What needs doing?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button onClick={add} disabled={!text.trim()}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {todos.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">Nothing to do. Add a task above.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {todos.map((todo) => (
            <li key={todo.id} className="flex items-center gap-3 p-3">
              <Checkbox
                id={`todo-${todo.id}`}
                checked={todo.done}
                onCheckedChange={() => dispatch({ type: 'toggle', id: todo.id })}
              />
              <Input
                value={todo.text}
                onChange={(e) => dispatch({ type: 'rename', id: todo.id, text: e.target.value })}
                className={cn('h-8 border-0 bg-transparent px-1 shadow-none', todo.done && 'text-muted-foreground line-through')}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${todo.text}`}
                onClick={() => dispatch({ type: 'remove', id: todo.id })}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground text-sm">
        {done} of {total} complete — derived from the list, not stored.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------
// 2. Chain reaction — one input ripples through derived components.
// ---------------------------------------------------------------------

interface Product {
  id: string
  name: string
  price: number
}

const products: Product[] = [
  { id: 'starter', name: 'Starter plan', price: 29 },
  { id: 'pro', name: 'Pro plan', price: 99 },
  { id: 'team', name: 'Team plan', price: 249 },
]

function ChainReactionDemo() {
  const [productId, setProductId] = useState('pro')
  const [quantity, setQuantity] = useState(1)

  // Every value below is derived. Change the product or the quantity
  // and the whole chain — subtotal, discount, tax, total — recomputes.
  const product = products.find((p) => p.id === productId)!
  const subtotal = product.price * quantity
  const discountRate = subtotal >= 200 ? 0.15 : subtotal >= 100 ? 0.1 : 0
  const discount = subtotal * discountRate
  const taxable = subtotal - discount
  const tax = taxable * 0.11
  const total = taxable + tax

  const money = (n: number) => `$${n.toFixed(2)}`

  return (
    <Grid gap="gap-6">
      <GridItem span={{ base: 12, md: 6 }}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chain-product">Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="chain-product">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {money(p.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="chain-qty">Quantity</Label>
            <Input
              id="chain-qty"
              type="number"
              min={1}
              max={10}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Quantity ≥ 3 unlocks a 10% discount; a subtotal ≥ $200 unlocks 15%.
          </p>
        </div>
      </GridItem>

      <GridItem span={{ base: 12, md: 6 }}>
        <div className="bg-muted/40 space-y-2 rounded-md border p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Unit price</span>
            <span>{money(product.price)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount ({(discountRate * 100).toFixed(0)}%)</span>
            <span className={discount > 0 ? 'text-emerald-600' : ''}>-{money(discount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax (11%)</span>
            <span>{money(tax)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
        </div>
      </GridItem>
    </Grid>
  )
}

// ---------------------------------------------------------------------
// 3. Custom events — components talking through window events.
// ---------------------------------------------------------------------

const PING_EVENT = 'app:ping'

function EventsDemo() {
  const [count, setCount] = useState(0)
  const [lastFrom, setLastFrom] = useState<string | null>(null)

  // Subscriber: listens for the custom event regardless of who sent it.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ from: string }>).detail
      setCount((c) => c + 1)
      setLastFrom(detail.from)
    }
    window.addEventListener(PING_EVENT, handler)
    return () => window.removeEventListener(PING_EVENT, handler)
  }, [])

  const ping = (from: string) => window.dispatchEvent(new CustomEvent(PING_EVENT, { detail: { from } }))

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Each button dispatches a <code>{PING_EVENT}</code> event; a single listener above receives them all.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => ping('button A')}>
          <Zap className="size-4" />
          Ping from A
        </Button>
        <Button variant="outline" onClick={() => ping('button B')}>
          <Zap className="size-4" />
          Ping from B
        </Button>
      </div>
      <Alert>
        <BadgeCheck className="size-4" />
        <div>
          <AlertTitle>Events received: {count}</AlertTitle>
          <AlertDescription>
            {lastFrom ? `Most recent sender: ${lastFrom}.` : 'No events received yet.'}
          </AlertDescription>
        </div>
      </Alert>
    </div>
  )
}

// ---------------------------------------------------------------------
// 4. DOM access — refs for focus, measurement and scrolling.
// ---------------------------------------------------------------------

function DomDemo() {
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  const measure = () => setWidth(boxRef.current?.getBoundingClientRect().width ?? null)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => inputRef.current?.focus()}>
          <Focus className="size-4" />
          Focus the input
        </Button>
        <Button variant="outline" onClick={() => inputRef.current?.scrollIntoView({ behavior: 'smooth' })}>
          Scroll to input
        </Button>
        <Button variant="outline" onClick={measure}>
          <Ruler className="size-4" />
          Measure box
        </Button>
      </div>

      <div ref={boxRef} className="bg-muted/40 rounded-md border p-4">
        <Label htmlFor="dom-input">Direct DOM control</Label>
        <Input id="dom-input" ref={inputRef} className="mt-2" placeholder="Focus lands here" />
        <p className="text-muted-foreground mt-2 text-xs">
          Box width: {width === null ? 'not measured yet' : `${width.toFixed(0)}px`}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// 5. Composition & class variants — the CVA pattern used across the UI.
// ---------------------------------------------------------------------

const statCard = cva('rounded-lg border p-4', {
  variants: {
    tone: {
      neutral: 'bg-background',
      positive: 'border-emerald-500/40 bg-emerald-500/10',
      warning: 'border-amber-500/40 bg-amber-500/10',
    },
    size: {
      sm: 'text-sm',
      md: 'text-base',
    },
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
})

function CompositionDemo() {
  const [tone, setTone] = useState<'neutral' | 'positive' | 'warning'>('neutral')
  const [size, setSize] = useState<'sm' | 'md'>('md')

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Variants are declared once with <code>cva</code> and selected by props — the same pattern behind every
        button, badge and alert in this starter.
      </p>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-2">
          <Label>Tone</Label>
          <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Size</Label>
          <Select value={size} onValueChange={(v) => setSize(v as typeof size)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sm">Small</SelectItem>
              <SelectItem value="md">Medium</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={statCard({ tone, size })}>
        <p className="font-medium">Active users</p>
        <p className="text-muted-foreground">1,204 this month</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// 6. Lifting state up — two sibling inputs sharing one source of truth.
// ---------------------------------------------------------------------

function LiftedStateDemo() {
  const [celsius, setCelsius] = useState(20)
  const fahrenheit = Math.round((celsius * 9) / 5 + 32)

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Both fields render the same state. Editing one updates the other because the value lives in their parent.
      </p>
      <Grid gap="gap-4">
        <GridItem span={{ base: 12, sm: 6 }}>
          <div className="space-y-2">
            <Label htmlFor="lift-c">Celsius</Label>
            <Input
              id="lift-c"
              type="number"
              value={celsius}
              onChange={(e) => setCelsius(Number(e.target.value))}
            />
          </div>
        </GridItem>
        <GridItem span={{ base: 12, sm: 6 }}>
          <div className="space-y-2">
            <Label htmlFor="lift-f">Fahrenheit</Label>
            <Input
              id="lift-f"
              type="number"
              value={fahrenheit}
              onChange={(e) => setCelsius(Math.round(((Number(e.target.value) - 32) * 5) / 9))}
            />
          </div>
        </GridItem>
      </Grid>
      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        {celsius}°C <ArrowRight className="size-3" /> {fahrenheit}°F
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------
// 7. Async state — loading, success and error around a promise.
// ---------------------------------------------------------------------

function AsyncStateDemo() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const run = async () => {
    setStatus('loading')
    await new Promise((r) => setTimeout(r, 900))
    // Simulate an occasional failure so both branches are reachable.
    if (Math.random() < 0.3) {
      setStatus('error')
      toast.error('Request failed (simulated).')
    } else {
      setStatus('success')
      toast.success('Request succeeded (simulated).')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        A single status value drives four distinct renderings — the pattern behind every data-fetching view.
      </p>
      <Button onClick={() => void run()} disabled={status === 'loading'}>
        <RefreshCw className={cn('size-4', status === 'loading' && 'animate-spin')} />
        Run request
      </Button>
      {status === 'idle' && (
        <p className="text-muted-foreground text-sm">Idle — press the button to start.</p>
      )}
      {status === 'loading' && <p className="text-muted-foreground text-sm">Loading…</p>}
      {status === 'success' && (
        <Alert variant="success">
          <BadgeCheck className="size-4" />
          <div>
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>The request resolved successfully.</AlertDescription>
          </div>
        </Alert>
      )}
      {status === 'error' && (
        <Alert variant="destructive">
          <MousePointerClick className="size-4" />
          <div>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Something went wrong. Try again.</AlertDescription>
          </div>
        </Alert>
      )}
    </div>
  )
}

export function PatternsPage() {
  useDocumentTitle('Patterns')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Patterns</h1>
        <p className="text-muted-foreground text-sm">
          Working examples of the mechanisms a real app needs — state, CRUD, chain reactions, events, DOM access
          and composition.
        </p>
      </div>

      <Section
        title="State & CRUD"
        description="A list held in a reducer with create, read, update and delete, plus derived counts."
      >
        <CrudDemo />
      </Section>

      <Section
        title="Chain reaction"
        description="Component A's value change flows into component B — and C, and D — through derived state."
      >
        <ChainReactionDemo />
      </Section>

      <Section
        title="Lifting state up"
        description="Two sibling inputs sharing one parent-owned value, kept in sync both ways."
      >
        <LiftedStateDemo />
      </Section>

      <Section
        title="Custom events"
        description="Decoupled communication between components via window events."
      >
        <EventsDemo />
      </Section>

      <Section
        title="DOM access"
        description="Refs for focusing, measuring and scrolling to elements imperatively."
      >
        <DomDemo />
      </Section>

      <Section
        title="Composition & class variants"
        description="Prop-driven styling with class-variance-authority, the pattern behind the design system."
      >
        <CompositionDemo />
      </Section>

      <Section
        title="Async state"
        description="Idle, loading, success and error renderings driven by one status value."
      >
        <AsyncStateDemo />
      </Section>

      <div className="text-muted-foreground flex flex-wrap gap-2 pb-4 text-xs">
        <Badge variant="secondary">useState</Badge>
        <Badge variant="secondary">useReducer</Badge>
        <Badge variant="secondary">useMemo</Badge>
        <Badge variant="secondary">useEffect</Badge>
        <Badge variant="secondary">useRef</Badge>
        <Badge variant="secondary">CustomEvent</Badge>
        <Badge variant="secondary">cva</Badge>
      </div>
    </div>
  )
}
