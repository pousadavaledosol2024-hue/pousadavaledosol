import { useEffect, useState } from 'react'
import { PublicRoom } from '../lib/supabase'
import { useData, hasOverbooking, calculateTotalPrice, getPriceBreakdown } from '../lib/store'
import { Check, AlertCircle, ArrowLeft, Calendar, Users, FileText, DollarSign } from 'lucide-react'

export default function BookingForm() {
  const { settings, reservations, rooms: storedRooms, addReservation } = useData()
  const [rooms, setRooms] = useState<PublicRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    room_id: '',
    guest_name: '',
    guest_document: '',
    guest_email: '',
    guest_phone: '',
    guest_birth_date: '',
    check_in: '',
    check_out: '',
    num_adults: 1,
    num_children: 0,
    arrival_time: '',
    observations: '',
    accepted_terms: false,
  })
  const [childrenAges, setChildrenAges] = useState<number[]>([])

  useEffect(() => {
    const publicRooms: PublicRoom[] = storedRooms
      .filter(room => room.status === 'available' || room.status === 'active')
      .map(room => ({ id: room.id, name: room.name, max_adults: room.max_adults, max_children: room.max_children, base_price: room.base_price }))
    setRooms(publicRooms)
    setLoading(false)
  }, [storedRooms])

  const selectedRoom = rooms.find(r => r.id === form.room_id)
  const storedRoom = storedRooms.find(r => r.id === form.room_id)
  const roomPrice = selectedRoom?.base_price ?? 0
  const nights = form.check_in && form.check_out
    ? Math.ceil((new Date(form.check_out).getTime() - new Date(form.check_in).getTime()) / 86400000)
    : 0
  const totalGuests = form.num_adults + form.num_children
  const roomDiscounts = storedRoom?.discounts || []
  const totalPrice = roomPrice > 0 && nights > 0
    ? calculateTotalPrice(roomPrice, form.num_adults, form.num_children, form.check_in, form.check_out, roomDiscounts, childrenAges)
    : 0
  const breakdown = roomPrice > 0 && nights > 0
    ? getPriceBreakdown(roomPrice, form.num_adults, form.num_children, form.check_in, form.check_out, childrenAges)
    : null

  const overbooking = form.room_id && form.check_in && form.check_out
    ? hasOverbooking(reservations, form.room_id, form.check_in, form.check_out)
    : false

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.accepted_terms) {
      setError('Você precisa aceitar os termos e políticas para continuar.')
      return
    }
    if (!form.room_id || !form.check_in || !form.check_out || !form.guest_name) {
      setError('Preencha todos os campos obrigatórios.')
      return
    }
    if (new Date(form.check_out) <= new Date(form.check_in)) {
      setError('A data de check-out deve ser depois do check-in.')
      return
    }
    if (overbooking) {
      setError('Já existe uma reserva para estas datas neste quarto. Por favor, escolha outras datas ou acomodação.')
      return
    }

    setSubmitting(true)
    addReservation({
      room_id: form.room_id,
      guest_name: form.guest_name,
      guest_document: form.guest_document,
      guest_email: form.guest_email,
      guest_phone: form.guest_phone,
      guest_birth_date: form.guest_birth_date || null,
      check_in: form.check_in,
      check_out: form.check_out,
      num_adults: form.num_adults,
      num_children: form.num_children,
      children_ages: childrenAges,
      arrival_time: form.arrival_time,
      observations: form.observations,
      accepted_terms: form.accepted_terms,
      status: 'pending',
      source: 'direct',
      total_price: totalPrice > 0 ? totalPrice : null,
    })
    setSubmitting(false)
    setSuccess(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <Check className="text-green-600" size={32} />
          </div>
          <h1 className="font-serif text-2xl text-stone-800 mb-3">Pré-reserva Enviada!</h1>
          <p className="text-stone-600 mb-6">
            Recebemos sua solicitação de reserva. Entraremos em contato pelo WhatsApp em breve para confirmar disponibilidade e pagamento.
          </p>
          <a href="/" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium text-sm">
            <ArrowLeft size={16} /> Voltar ao site
          </a>
        </div>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-stone-600 hover:text-stone-800 transition-colors text-sm">
            <ArrowLeft size={16} /> Voltar
          </a>
          <div className="flex items-center gap-2">
            <img src={settings?.logo_url || '/logo.svg'} alt="Logo da pousada" className="h-8 w-12 object-contain rounded" />
            <h1 className="font-serif text-lg text-stone-800">{settings?.name || 'Pousada'}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="font-serif text-3xl text-stone-800 mb-2">Solicitar Reserva</h2>
          <p className="text-stone-500">Preencha o formulário abaixo. Sua solicitação será analisada e entraremos em contato.</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2 text-red-700 text-sm">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {overbooking && form.check_in && form.check_out && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-2 text-amber-700 text-sm">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span>As datas selecionadas já possuem uma reserva para esta acomodação. Por favor, escolha outras datas.</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-6">
          {/* Hospedagem */}
          <Section icon={Calendar} title="Dados da Hospedagem">
            <Field label="Acomodação *">
              <select
                value={form.room_id}
                onChange={e => setForm({ ...form, room_id: e.target.value })}
                required
                className={inputCls}
              >
                <option value="">Selecione...</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.max_adults} adultos, {r.max_children} crianças)
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Check-in *">
                <input type="date" min={today} value={form.check_in} onChange={e => setForm({ ...form, check_in: e.target.value })} required className={inputCls} />
              </Field>
              <Field label="Check-out *">
                <input type="date" min={form.check_in || today} value={form.check_out} onChange={e => setForm({ ...form, check_out: e.target.value })} required className={inputCls} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Adultos *">
                <input type="number" min={1} max={20} value={form.num_adults} onChange={e => setForm({ ...form, num_adults: +e.target.value })} required className={inputCls} />
              </Field>
              <Field label="Crianças">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={form.num_children}
                  onChange={e => {
                    const n = Math.max(0, +e.target.value)
                    setForm({ ...form, num_children: n })
                    setChildrenAges(prev => {
                      const next = [...prev]
                      while (next.length < n) next.push(0)
                      while (next.length > n) next.pop()
                      return next
                    })
                  }}
                  className={inputCls}
                />
              </Field>
            </div>
            {form.num_children > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-stone-600">Idade das crianças</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Array.from({ length: form.num_children }).map((_, i) => (
                    <div key={i}>
                      <label className="block text-xs text-stone-400 mb-1">Criança {i + 1}</label>
                      <input
                        type="number"
                        min={0}
                        max={17}
                        value={childrenAges[i] ?? 0}
                        onChange={e => {
                          const age = Math.max(0, Math.min(17, +e.target.value))
                          setChildrenAges(prev => {
                            const next = [...prev]
                            while (next.length <= i) next.push(0)
                            next[i] = age
                            return next
                          })
                        }}
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Field label="Horário previsto de chegada">
              <input type="time" value={form.arrival_time} onChange={e => setForm({ ...form, arrival_time: e.target.value })} className={inputCls} />
            </Field>
          </Section>

          {/* Price Summary */}
          {breakdown && breakdown.total > 0 && (
            <div className="bg-primary-50 border border-primary-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 text-primary-700 font-medium text-sm mb-4">
                <DollarSign size={20} /> Resumo do Valor
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-600">Noites</span>
                  <span className="text-stone-800 font-medium">{breakdown.nights}</span>
                </div>

                {breakdown.adultCount > 0 && (
                  <div className="pt-2 border-t border-primary-100 space-y-1">
                    <p className="text-xs text-stone-500 font-medium">Adultos (+10 anos)</p>
                    <div className="flex justify-between">
                      <span className="text-stone-600">{breakdown.adultCount} × R$ {breakdown.adultUnitPrice.toFixed(2).replace('.', ',')} × {breakdown.nights} noites</span>
                      <span className="text-stone-800 font-medium">R$ {(breakdown.adultUnitPrice * breakdown.adultCount * breakdown.nights).toFixed(2).replace('.', ',')}</span>
                    </div>
                    {breakdown.groupDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Desconto de grupo (10% por adulto adicional)</span>
                        <span className="font-medium">- R$ {breakdown.groupDiscount.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-stone-600 font-medium">Subtotal adultos</span>
                      <span className="text-stone-800 font-medium">R$ {breakdown.adultSubtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                )}

                {breakdown.child410Count > 0 && (
                  <div className="pt-2 border-t border-primary-100 space-y-1">
                    <p className="text-xs text-stone-500 font-medium">Crianças 4-10 anos (25% de desconto)</p>
                    <div className="flex justify-between">
                      <span className="text-stone-600">{breakdown.child410Count} × R$ {breakdown.child410UnitPrice.toFixed(2).replace('.', ',')} × {breakdown.nights} noites</span>
                      <span className="text-stone-800 font-medium">R$ {breakdown.child410Subtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                )}

                {breakdown.child04Count > 0 && (
                  <div className="pt-2 border-t border-primary-100 space-y-1">
                    <p className="text-xs text-stone-500 font-medium">Crianças 0-3 anos (100% de desconto)</p>
                    <div className="flex justify-between">
                      <span className="text-stone-600">{breakdown.child04Count} × R$ 0,00 × {breakdown.nights} noites</span>
                      <span className="text-stone-800 font-medium">R$ 0,00</span>
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-primary-200 flex justify-between items-center">
                  <span className="text-stone-700 font-medium">Valor Total</span>
                  <span className="text-primary-700 font-bold text-xl">R$ {breakdown.total.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Dados pessoais */}
          <Section icon={Users} title="Dados Pessoais (FNRH)">
            <Field label="Nome completo *">
              <input type="text" value={form.guest_name} onChange={e => setForm({ ...form, guest_name: e.target.value })} required className={inputCls} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="CPF / Passaporte">
                <input type="text" value={form.guest_document} onChange={e => setForm({ ...form, guest_document: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Data de nascimento">
                <input type="date" value={form.guest_birth_date} onChange={e => setForm({ ...form, guest_birth_date: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <Field label="E-mail">
              <input type="email" value={form.guest_email} onChange={e => setForm({ ...form, guest_email: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Telefone / WhatsApp">
              <input type="tel" value={form.guest_phone} onChange={e => setForm({ ...form, guest_phone: e.target.value })} placeholder="(00) 00000-0000" className={inputCls} />
            </Field>
          </Section>

          {/* Observações */}
          <Section icon={FileText} title="Observações">
            <Field label="Observações especiais (necessidades, preferências, etc.)">
              <textarea rows={3} value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} className={inputCls} />
            </Field>
          </Section>

          {/* Termos */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.accepted_terms}
                onChange={e => setForm({ ...form, accepted_terms: e.target.checked })}
                className="mt-1 w-5 h-5 rounded border-stone-300 text-primary-600 focus:ring-primary-400"
              />
              <span className="text-sm text-stone-600">
                Aceito as <strong>políticas de cancelamento</strong> e as <strong>regras de convivência</strong> da pousada.
                Estou ciente de que esta é uma solicitação de pré-reserva e a confirmação está sujeita à disponibilidade.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting || overbooking}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Check size={20} /> Enviar Solicitação
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6">
      <div className="flex items-center gap-2 mb-5">
        <Icon size={20} className="text-primary-500" />
        <h3 className="font-serif text-lg text-stone-800">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-600 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-stone-200 rounded-lg px-3 py-2.5 text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-shadow'
