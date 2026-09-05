import { useEffect, useState, useRef, Component, ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { useData, hasOverbooking, calculateTotalPrice, getApplicableDiscounts, getPriceBreakdown, compressImage, useMediaUrl, useMediaUrls, storeMedia } from '../lib/store'
import { idbGetAsObjectURL, idbDelete } from '../lib/idb-storage'
import { InnSettings, GalleryPhoto, Room, Reservation, ICalFeed, ReservationStatus, STATUS_COLORS, STATUS_LABELS, SOURCE_LABELS, ROOM_STATUS_LABELS, ROOM_STATUS_COLORS, OTALink, DiscountRule, DiscountType, DiscountScope } from '../lib/supabase'
import {
  Save, Plus, Trash2, Eye, Lock, Image, Settings,
  ArrowLeft, Check, AlertCircle, Calendar, BedDouble,
  ClipboardList, Link2, RefreshCw, X, MessageCircle,
  ChevronLeft, ChevronRight, Upload, DollarSign
} from 'lucide-react'

type Tab = 'reservations' | 'calendar' | 'rooms' | 'ical' | 'settings' | 'gallery'

export default function AdminPage() {
  return (
    <AdminErrorBoundary>
      <AdminPageInner />
    </AdminErrorBoundary>
  )
}

class AdminErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  handleReset = () => {
    try {
      localStorage.removeItem('pousada_data_v3')
      localStorage.removeItem('pousada_session_v2')
    } catch {}
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
            <AlertCircle className="text-red-500 mx-auto mb-4" size={32} />
            <h1 className="font-serif text-lg text-stone-800 mb-2">Erro ao carregar o painel</h1>
            <p className="text-sm text-stone-500 mb-4">Ocorreu um problema ao ler os dados locais.</p>
            <button
              onClick={this.handleReset}
              className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Resetar Sessão
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AdminPageInner() {
  const { user, loading: authLoading, signIn, signUp, signOut, resetPassword } = useAuth()
  const { settings, photos, rooms, reservations, feeds, users, loading, reload, updateReservation, deleteReservation, addReservation, addRoom, updateRoom, deleteRoom, addFeed, deleteFeed, saveSettings, addPhoto, deletePhoto, addUser, updateUser, deleteUser } = useData()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('reservations')
  const logoUrl = useMediaUrl(settings?.logo_url || '') || '/logo.svg'

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError(null)
    setAuthBusy(true)
    const fn = mode === 'login' ? signIn : signUp
    const { error } = await fn(email, password)
    setAuthBusy(false)
    if (error) setAuthError(error)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
            <Lock className="text-primary-600" size={26} />
          </div>
          <h1 className="font-serif text-2xl text-stone-800 text-center mb-2">Área Administrativa</h1>
          <p className="text-stone-500 text-sm text-center mb-6">
            {mode === 'login' ? 'Entre com sua conta' : 'Crie sua conta de administrador'}
          </p>
          <form onSubmit={handleAuth} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="E-mail"
              required
              className="w-full border border-stone-200 rounded-lg px-4 py-3 text-stone-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Senha"
              required
              minLength={6}
              className="w-full border border-stone-200 rounded-lg px-4 py-3 text-stone-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            {mode === 'login' && <ForgotPassword resetPassword={resetPassword} />}
            {authError && (
              <p className="text-red-500 text-sm flex items-center gap-1">
                <AlertCircle size={14} /> {authError}
              </p>
            )}
            <button
              type="submit"
              disabled={authBusy}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white py-3 rounded-lg font-medium transition-colors"
            >
              {authBusy ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setAuthError(null) }}
            className="w-full text-center text-sm text-primary-600 hover:text-primary-700 mt-4 transition-colors"
          >
            {mode === 'login' ? 'Não tem conta? Criar agora' : 'Já tem conta? Entrar'}
          </button>
          <div className="mt-4 text-center">
            <a href="/" className="text-sm text-stone-400 hover:text-stone-600 flex items-center justify-center gap-1 transition-colors">
              <ArrowLeft size={14} /> Ver site
            </a>
          </div>
        </div>
      </div>
    )
  }

  const pendingCount = reservations.filter(r => r.status === 'pending').length

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="bg-stone-800 text-white px-4 sm:px-6 py-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 w-16 object-contain rounded bg-white/90 p-1" />}
          <h1 className="font-serif text-lg font-semibold">Painel Administrativo</h1>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-1.5 text-stone-400 hover:text-white text-sm transition-colors">
            <Eye size={16} /> Ver site
          </a>
          <button onClick={signOut} className="text-stone-400 hover:text-white text-sm transition-colors">Sair</button>
        </div>
      </header>

      <div className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {([
            ['reservations', ClipboardList, 'Reservas', pendingCount],
            ['calendar', Calendar, 'Calendário', null],
            ['rooms', BedDouble, 'Quartos', null],
            ['ical', Link2, 'iCal / OTAs', null],
            ['settings', Settings, 'Configurações', null],
            ['gallery', Image, 'Galeria', null],
          ] as const).map(([id, Icon, label, badge]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === id ? 'border-primary-500 text-primary-600' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
            >
              <Icon size={16} />
              {label}
              {badge != null && badge > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'reservations' ? (
          <ReservationsTab reservations={reservations} rooms={rooms} settings={settings} onUpdate={reload} onUpdateReservation={updateReservation} onDeleteReservation={deleteReservation} onAddReservation={addReservation} />
        ) : tab === 'calendar' ? (
          <CalendarTab reservations={reservations} rooms={rooms} />
        ) : tab === 'rooms' ? (
          <RoomsTab rooms={rooms} onUpdate={reload} onAddRoom={addRoom} onUpdateRoom={updateRoom} onDeleteRoom={deleteRoom} />
        ) : tab === 'ical' ? (
          <ICalTab rooms={rooms} feeds={feeds} onUpdate={reload} onAddFeed={addFeed} onDeleteFeed={deleteFeed} />
        ) : tab === 'settings' ? (
          <SettingsTab settings={settings} users={users} onSave={saveSettings} onAddUser={addUser} onUpdateUser={updateUser} onDeleteUser={deleteUser} />
        ) : (
          <GalleryTab photos={photos} onUpdate={reload} onAddPhoto={addPhoto} onDeletePhoto={deletePhoto} />
        )}
      </main>
    </div>
  )
}

function ForgotPassword({ resetPassword }: { resetPassword: (email: string) => { error: string | null; hint?: string } }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  return (
    <div className="text-center">
      <button type="button" onClick={() => { setOpen(!open); setMessage(null) }} className="text-xs text-stone-500 hover:text-primary-600">Esqueci minha senha</button>
      {open && <div className="mt-2 space-y-2 text-left">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Digite seu e-mail" className={inputCls} />
        <button type="button" onClick={() => { const result = resetPassword(email); setMessage(result.error || result.hint || '') }} className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 py-2 rounded-lg text-xs font-medium">Ver instruções</button>
        {message && <p className="text-xs text-stone-600 bg-stone-50 rounded p-2">{message}</p>}
      </div>}
    </div>
  )
}

// ============ RESERVATIONS TAB ============
function ReservationsTab({ reservations, rooms, settings, onUpdate, onUpdateReservation, onDeleteReservation, onAddReservation }: {
  reservations: Reservation[]
  rooms: Room[]
  settings: InnSettings | null
  onUpdate: () => void
  onUpdateReservation: (id: string, data: Partial<Reservation>) => void
  onDeleteReservation: (id: string) => void
  onAddReservation: (data: Partial<Reservation>) => void
}) {
  const [filter, setFilter] = useState<ReservationStatus | 'all'>('all')
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [showManual, setShowManual] = useState(false)

  const roomName = (id: string) => rooms.find(r => r.id === id)?.name || '?'
  const roomPrice = (id: string) => rooms.find(r => r.id === id)?.base_price ?? 0
  const roomDiscounts = (id: string) => rooms.find(r => r.id === id)?.discounts || []
  const filtered = filter === 'all' ? reservations : reservations.filter(r => r.status === filter)

  async function updateStatus(id: string, status: ReservationStatus) {
    onUpdateReservation(id, { status })
    onUpdate()
    setSelected(null)
  }

  async function deleteReservation(id: string) {
    if (!confirm('Excluir esta reserva permanentemente?')) return
    onDeleteReservation(id)
    onUpdate()
    setSelected(null)
  }

  function generateWhatsAppMessage(r: Reservation) {
    const checkin = new Date(r.check_in + 'T00:00').toLocaleDateString('pt-BR')
    const checkout = new Date(r.check_out + 'T00:00').toLocaleDateString('pt-BR')
    const nights = Math.ceil((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000)
    const lines = [
      `Olá, ${r.guest_name}! Confirmando sua reserva na ${settings?.name || 'Pousada'}:`,
      ``,
      `Quarto: ${roomName(r.room_id)}`,
      `Check-in: ${checkin}`,
      `Check-out: ${checkout}`,
      `Noites: ${nights}`,
      `Hóspedes: ${r.num_adults} adulto(s)${r.num_children > 0 ? `, ${r.num_children} criança(s)` : ''}`,
      r.total_price ? `Valor total: R$ ${r.total_price.toFixed(2).replace('.', ',')}` : '',
      ``,
      `Chave PIX (${settings?.pix_key_type || 'Pix'}): ${settings?.pix_key || ''}`,
      `Envie o comprovante por aqui para confirmarmos!`,
    ].filter(Boolean)
    return encodeURIComponent(lines.join('\n'))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'pending', 'confirmed', 'cancelled', 'blocked'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? 'bg-primary-600 text-white' : 'bg-white text-stone-600 border border-stone-200 hover:border-primary-300'}`}
            >
              {s === 'all' ? 'Todas' : STATUS_LABELS[s]}
              <span className="ml-1.5 text-xs opacity-70">
                {s === 'all' ? reservations.length : reservations.filter(r => r.status === s).length}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowManual(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nova Reserva Manual
        </button>
      </div>

      {filtered.length === 0 ? (
        <Card title=""><p className="text-stone-400 text-sm text-center py-8">Nenhuma reserva encontrada.</p></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const price = r.total_price ?? calculateTotalPrice(roomPrice(r.room_id), r.num_adults, r.num_children, r.check_in, r.check_out, roomDiscounts(r.room_id), r.children_ages || [])
            return (
              <div key={r.id} className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                    <span className="text-xs text-stone-400">{SOURCE_LABELS[r.source]}</span>
                  </div>
                  <p className="font-medium text-stone-800 truncate">{r.guest_name}</p>
                  <p className="text-sm text-stone-500">
                    {roomName(r.room_id)} · {new Date(r.check_in + 'T00:00').toLocaleDateString('pt-BR')} → {new Date(r.check_out + 'T00:00').toLocaleDateString('pt-BR')}
                  </p>
                  {price > 0 && <p className="text-sm text-stone-600 font-medium">R$ {price.toFixed(2).replace('.', ',')}</p>}
                </div>
                <button
                  onClick={() => setSelected(r)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium flex-shrink-0"
                >
                  Detalhes
                </button>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <Modal title="Detalhes da Reserva" onClose={() => setSelected(null)}>
          <ReservationDetail r={selected} roomName={roomName(selected.room_id)} roomPrice={roomPrice(selected.room_id)} roomDiscounts={roomDiscounts(selected.room_id)} childrenAges={selected.children_ages || []} />
          <div className="mt-6 flex flex-wrap gap-2">
            {selected.status !== 'confirmed' && (
              <button
                onClick={() => updateStatus(selected.id, 'confirmed')}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Confirmar
              </button>
            )}
            {selected.status !== 'cancelled' && (
              <button
                onClick={() => updateStatus(selected.id, 'cancelled')}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Recusar/Cancelar
              </button>
            )}
            {selected.guest_phone && (
              <a
                href={`https://wa.me/${selected.guest_phone.replace(/\D/g, '')}?text=${generateWhatsAppMessage(selected)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <MessageCircle size={16} /> Enviar WhatsApp
              </a>
            )}
            <button
              onClick={() => deleteReservation(selected.id)}
              className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} /> Excluir
            </button>
          </div>
        </Modal>
      )}

      {showManual && (
        <ManualReservationModal
          rooms={rooms}
          reservations={reservations}
          settings={settings}
          onClose={() => setShowManual(false)}
          onSave={async (data) => {
            onAddReservation(data)
            onUpdate()
            setShowManual(false)
          }}
        />
      )}
    </div>
  )
}

function ReservationDetail({ r, roomName, roomPrice, roomDiscounts, childrenAges }: { r: Reservation; roomName: string; roomPrice: number; roomDiscounts: DiscountRule[]; childrenAges: number[] }) {
  const nights = Math.ceil((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000)
  const totalGuests = r.num_adults + r.num_children
  const breakdown = getPriceBreakdown(roomPrice, r.num_adults, r.num_children, r.check_in, r.check_out, childrenAges)
  const displayTotal = r.total_price ?? breakdown.total

  return (
    <div className="space-y-3 text-sm">
      <DataRow label="Hóspede" value={r.guest_name} />
      <DataRow label="Documento" value={r.guest_document || '—'} />
      <DataRow label="E-mail" value={r.guest_email || '—'} />
      <DataRow label="Telefone/WhatsApp" value={r.guest_phone || '—'} />
      <DataRow label="Nascimento" value={r.guest_birth_date ? new Date(r.guest_birth_date + 'T00:00').toLocaleDateString('pt-BR') : '—'} />
      <DataRow label="Quarto" value={roomName} />
      <DataRow label="Check-in" value={new Date(r.check_in + 'T00:00').toLocaleDateString('pt-BR')} />
      <DataRow label="Check-out" value={new Date(r.check_out + 'T00:00').toLocaleDateString('pt-BR')} />
      <DataRow label="Adultos" value={String(r.num_adults)} />
      <DataRow label="Crianças" value={r.num_children > 0 ? `${r.num_children} (${(r.children_ages || []).join(', ') || '—'})` : '0'} />
      <DataRow label="Horário previsto" value={r.arrival_time || '—'} />
      <DataRow label="Observações" value={r.observations || '—'} />
      <DataRow label="Origem" value={SOURCE_LABELS[r.source]} />
      <DataRow label="Status" value={STATUS_LABELS[r.status]} />
      {roomPrice > 0 && breakdown.nights > 0 && (
        <div className="pt-3 border-t border-stone-200 space-y-1">
          <p className="font-medium text-stone-700">Cálculo do Valor:</p>
          <DataRow label="Noites" value={String(breakdown.nights)} />
          {breakdown.adultCount > 0 && (
            <>
              <DataRow label={`Adultos (${breakdown.adultCount} × R$ ${breakdown.adultUnitPrice.toFixed(2).replace('.', ',')} × ${breakdown.nights})`} value={`R$ ${(breakdown.adultUnitPrice * breakdown.adultCount * breakdown.nights).toFixed(2).replace('.', ',')}`} />
              {breakdown.groupDiscount > 0 && (
                <DataRow label="Desconto de grupo (10% por adulto adicional)" value={`- R$ ${breakdown.groupDiscount.toFixed(2).replace('.', ',')}`} />
              )}
              <DataRow label="Subtotal adultos" value={`R$ ${breakdown.adultSubtotal.toFixed(2).replace('.', ',')}`} />
            </>
          )}
          {breakdown.child410Count > 0 && (
            <DataRow label={`Crianças 4-10 anos (${breakdown.child410Count} × R$ ${breakdown.child410UnitPrice.toFixed(2).replace('.', ',')} × ${breakdown.nights})`} value={`R$ ${breakdown.child410Subtotal.toFixed(2).replace('.', ',')}`} />
          )}
          {breakdown.child04Count > 0 && (
            <DataRow label={`Crianças 0-3 anos (${breakdown.child04Count})`} value="R$ 0,00" />
          )}
          <div className="flex gap-2 pt-1">
            <span className="text-stone-400 w-32 flex-shrink-0">Valor Total:</span>
            <span className="text-stone-800 font-bold text-base">R$ {displayTotal.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function ManualReservationModal({ rooms, reservations, settings, onClose, onSave }: {
  rooms: Room[]
  reservations: Reservation[]
  settings: InnSettings | null
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [form, setForm] = useState({
    room_id: '',
    guest_name: '',
    guest_document: '',
    guest_email: '',
    guest_phone: '',
    check_in: '',
    check_out: '',
    num_adults: 1,
    num_children: 0,
    arrival_time: '',
    observations: '',
    status: 'confirmed' as ReservationStatus,
  })
  const [childrenAges, setChildrenAges] = useState<number[]>([])
  const [overbooking, setOverbooking] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedRoom = rooms.find(r => r.id === form.room_id)
  const breakdown = form.check_in && form.check_out && selectedRoom
    ? getPriceBreakdown(selectedRoom.base_price, form.num_adults, form.num_children, form.check_in, form.check_out, childrenAges)
    : null
  const totalPrice = breakdown?.total ?? 0
  const nights = breakdown?.nights ?? 0

  useEffect(() => {
    if (form.room_id && form.check_in && form.check_out) {
      setOverbooking(hasOverbooking(reservations, form.room_id, form.check_in, form.check_out))
    } else {
      setOverbooking(false)
    }
  }, [form.room_id, form.check_in, form.check_out, reservations])

  async function handleSave() {
    if (!form.room_id || !form.guest_name || !form.check_in || !form.check_out) {
      alert('Preencha os campos obrigatórios.')
      return
    }
    if (new Date(form.check_out) <= new Date(form.check_in)) {
      alert('O check-out deve ser depois do check-in.')
      return
    }
    if (overbooking) {
      if (!confirm('Atenção: já existe uma reserva para estas datas neste quarto. Deseja criar mesmo assim?')) return
    }
    setSaving(true)
    await onSave({
      ...form,
      children_ages: childrenAges,
      guest_birth_date: null,
      accepted_terms: true,
      source: 'manual',
      total_price: totalPrice,
    })
    setSaving(false)
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <Modal title="Nova Reserva Manual" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Acomodação *">
          <select value={form.room_id} onChange={e => setForm({ ...form, room_id: e.target.value })} className={inputCls}>
            <option value="">Selecione...</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name} — R$ {r.base_price.toFixed(2)}/hóspede/noite</option>)}
          </select>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Check-in *">
            <input type="date" min={today} value={form.check_in} onChange={e => setForm({ ...form, check_in: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Check-out *">
            <input type="date" min={form.check_in || today} value={form.check_out} onChange={e => setForm({ ...form, check_out: e.target.value })} className={inputCls} />
          </Field>
        </div>
        {overbooking && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-red-700 text-sm">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span><strong>Atenção:</strong> Já existe uma reserva para estas datas neste quarto. Verifique o calendário para evitar overbooking.</span>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Adultos *">
            <input type="number" min={1} value={form.num_adults} onChange={e => setForm({ ...form, num_adults: +e.target.value })} className={inputCls} />
          </Field>
          <Field label="Crianças">
            <input
              type="number"
              min={0}
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
        <Field label="Nome do hóspede *">
          <input type="text" value={form.guest_name} onChange={e => setForm({ ...form, guest_name: e.target.value })} className={inputCls} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="CPF / Passaporte">
            <input type="text" value={form.guest_document} onChange={e => setForm({ ...form, guest_document: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Telefone / WhatsApp">
            <input type="tel" value={form.guest_phone} onChange={e => setForm({ ...form, guest_phone: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field label="E-mail">
          <input type="email" value={form.guest_email} onChange={e => setForm({ ...form, guest_email: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Horário previsto de chegada">
          <input type="time" value={form.arrival_time} onChange={e => setForm({ ...form, arrival_time: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Observações">
          <textarea rows={2} value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Status da reserva">
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ReservationStatus })} className={inputCls}>
            <option value="confirmed">Confirmada</option>
            <option value="pending">Pendente</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </Field>

        {breakdown && breakdown.total > 0 && (
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-primary-700 font-medium text-sm">
              <DollarSign size={18} /> Resumo do Valor
            </div>
            <div className="text-sm text-stone-600 space-y-1">
              <p>Noites: <strong>{breakdown.nights}</strong></p>
              {breakdown.adultCount > 0 && (
                <p>Adultos ({breakdown.adultCount} × R$ {breakdown.adultUnitPrice.toFixed(2).replace('.', ',')} × {breakdown.nights}): <strong>R$ {(breakdown.adultUnitPrice * breakdown.adultCount * breakdown.nights).toFixed(2).replace('.', ',')}</strong></p>
              )}
              {breakdown.groupDiscount > 0 && (
                <p className="text-green-600">Desconto de grupo: <strong>- R$ {breakdown.groupDiscount.toFixed(2).replace('.', ',')}</strong></p>
              )}
              {breakdown.child410Count > 0 && (
                <p>Crianças 4-10 anos ({breakdown.child410Count} × R$ {breakdown.child410UnitPrice.toFixed(2).replace('.', ',')} × {breakdown.nights}): <strong>R$ {breakdown.child410Subtotal.toFixed(2).replace('.', ',')}</strong></p>
              )}
              {breakdown.child04Count > 0 && (
                <p>Crianças 0-3 anos ({breakdown.child04Count}): <strong>R$ 0,00</strong></p>
              )}
              <div className="pt-2 border-t border-primary-200">
                <p className="text-lg font-bold text-primary-700">Valor Total: R$ {breakdown.total.toFixed(2).replace('.', ',')}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Save size={16} /> {saving ? 'Salvando...' : 'Criar Reserva'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ============ CALENDAR TAB ============
function CalendarTab({ reservations, rooms }: { reservations: Reservation[]; rooms: Room[] }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedRoom, setSelectedRoom] = useState<string>('all')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  const filteredRes = selectedRoom === 'all' ? reservations : reservations.filter(r => r.room_id === selectedRoom)

  function getReservationsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return filteredRes.filter(r =>
      r.status !== 'cancelled' &&
      dateStr >= r.check_in &&
      dateStr < r.check_out
    )
  }

  const roomName = (id: string) => rooms.find(r => r.id === id)?.name || '?'

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
            <ChevronLeft size={20} className="text-stone-600" />
          </button>
          <h2 className="font-serif text-xl text-stone-800">
            {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h2>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
            <ChevronRight size={20} className="text-stone-600" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="ml-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
            Hoje
          </button>
        </div>
        <select
          value={selectedRoom}
          onChange={e => setSelectedRoom(e.target.value)}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option value="all">Todos os quartos</option>
          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs">
        {(Object.keys(STATUS_COLORS) as ReservationStatus[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full border ${STATUS_COLORS[s]}`} />
            <span className="text-stone-600">{STATUS_LABELS[s]}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-stone-200">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-stone-500 py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-stone-100 bg-stone-50" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dayRes = getReservationsForDay(day)
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString()
            return (
              <div key={day} className="min-h-[80px] border-b border-r border-stone-100 p-1.5 last:border-r-0">
                <div className={`text-xs font-medium mb-1 ${isToday ? 'bg-primary-500 text-white w-5 h-5 rounded-full flex items-center justify-center' : 'text-stone-600'}`}>
                  {day}
                </div>
                <div className="space-y-1">
                  {dayRes.slice(0, 3).map(r => (
                    <div key={r.id} className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${STATUS_COLORS[r.status]}`}>
                      {roomName(r.room_id)} · {r.guest_name.split(' ')[0]}
                    </div>
                  ))}
                  {dayRes.length > 3 && <div className="text-[10px] text-stone-400">+{dayRes.length - 3} mais</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============ ROOMS TAB ============
function RoomsTab({ rooms, onUpdate, onAddRoom, onUpdateRoom, onDeleteRoom }: { rooms: Room[]; onUpdate: () => void; onAddRoom: (r: Partial<Room>) => void; onUpdateRoom: (id: string, r: Partial<Room>) => void; onDeleteRoom: (id: string) => void }) {
  const [editing, setEditing] = useState<Room | null>(null)
  const [creating, setCreating] = useState(false)

  async function saveRoom(room: Partial<Room>) {
    if (creating) {
      onAddRoom(room)
    } else if (editing) {
      onUpdateRoom(editing.id, room)
    }
    setEditing(null)
    setCreating(false)
    await onUpdate()
  }

  async function deleteRoom(id: string) {
    if (!confirm('Excluir este quarto? As reservas associadas também serão removidas.')) return
    onDeleteRoom(id)
    onUpdate()
  }

  const icalUrl = (token: string) => `${window.location.origin}/ical-export?token=${token}`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-xl text-stone-800">Acomodações ({rooms.length})</h2>
        <button
          onClick={() => { setCreating(true); setEditing({} as Room) }}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Novo Quarto
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {rooms.map(room => (
          <div key={room.id} className="bg-white rounded-xl shadow-sm border border-stone-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-serif text-lg text-stone-800">{room.name}</h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROOM_STATUS_COLORS[room.status] || 'bg-stone-100 text-stone-600'}`}>
                  {ROOM_STATUS_LABELS[room.status] || room.status}
                </span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(room)} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                  <Settings size={16} className="text-stone-500" />
                </button>
                <button onClick={() => deleteRoom(room.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 size={16} className="text-red-400" />
                </button>
              </div>
            </div>
            {room.description && <p className="text-sm text-stone-500 mb-3">{room.description}</p>}
            <div className="text-sm text-stone-600 space-y-1">
              <p>Capacidade: {room.max_adults} adulto(s), {room.max_children} criança(s)</p>
              <p>Diária: R$ {room.base_price.toFixed(2).replace('.', ',')} <span className="text-stone-400">por hóspede / noite</span></p>
              <p>Estadia mínima: {room.min_stay} noite(s)</p>
              {room.amenities.length > 0 && <p>Comodidades: {room.amenities.join(', ')}</p>}
            </div>
            <div className="mt-4 pt-3 border-t border-stone-100">
              <p className="text-xs text-stone-400 mb-1">URL iCal (para Airbnb/Booking):</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={icalUrl(room.ical_export_token)}
                  className="flex-1 text-xs bg-stone-50 border border-stone-200 rounded px-2 py-1 text-stone-600 truncate"
                  onClick={e => e.currentTarget.select()}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(icalUrl(room.ical_export_token))}
                  className="text-xs bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded transition-colors"
                >
                  Copiar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <RoomEditor
          room={editing}
          creating={creating}
          onSave={saveRoom}
          onClose={() => { setEditing(null); setCreating(false) }}
        />
      )}
    </div>
  )
}

function RoomEditor({ room, creating, onSave, onClose }: {
  room: Room
  creating: boolean
  onSave: (r: Partial<Room>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name: room.name || '',
    description: room.description || '',
    max_adults: room.max_adults ?? 2,
    max_children: room.max_children ?? 0,
    base_price: room.base_price ?? 0,
    amenities: room.amenities?.join(', ') || '',
    status: room.status || 'available',
    min_stay: room.min_stay ?? 1,
  })
  const [discounts, setDiscounts] = useState<DiscountRule[]>(room.discounts || [])
  const [editingDiscount, setEditingDiscount] = useState<DiscountRule | null>(null)

  function addDiscount(rule: DiscountRule) {
    setDiscounts(prev => {
      const existing = prev.findIndex(d => d.id === rule.id)
      if (existing >= 0) {
        const next = [...prev]
        next[existing] = rule
        return next
      }
      return [...prev, rule]
    })
    setEditingDiscount(null)
  }

  function removeDiscount(id: string) {
    setDiscounts(prev => prev.filter(d => d.id !== id))
  }

  function toggleDiscount(id: string) {
    setDiscounts(prev => prev.map(d => d.id === id ? { ...d, enabled: !d.enabled } : d))
  }

  return (
    <Modal title={creating ? 'Novo Quarto' : 'Editar Quarto'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nome">
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Ex: Quarto 1, Chalé" />
        </Field>
        <Field label="Descrição">
          <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Max. Adultos">
            <input type="number" min={1} value={form.max_adults} onChange={e => setForm({ ...form, max_adults: +e.target.value })} className={inputCls} />
          </Field>
          <Field label="Max. Crianças">
            <input type="number" min={0} value={form.max_children} onChange={e => setForm({ ...form, max_children: +e.target.value })} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Diária por hóspede (R$)">
            <input type="number" min={0} step="0.01" value={form.base_price} onChange={e => setForm({ ...form, base_price: +e.target.value })} className={inputCls} />
          </Field>
          <Field label="Estadia mínima (noites)">
            <input type="number" min={1} value={form.min_stay} onChange={e => setForm({ ...form, min_stay: +e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field label="Comodidades (separadas por vírgula)">
          <input type="text" value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })} className={inputCls} placeholder="Wi-Fi, Ar-condicionado, TV" />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Room['status'] })} className={inputCls}>
            <option value="available">Disponível</option>
            <option value="occupied">Ocupado</option>
            <option value="maintenance">Manutenção</option>
            <option value="cleaning">Limpeza</option>
          </select>
        </Field>

        {/* Discount Rules Section */}
        <div className="border-t border-stone-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign size={18} className="text-primary-600" />
              <h4 className="font-medium text-stone-800 text-sm">Regras de Desconto</h4>
              {discounts.length > 0 && (
                <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">{discounts.length}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditingDiscount({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
                label: '',
                scope: 'period',
                type: 'percentage',
                value: 10,
                start_date: '',
                end_date: '',
                min_guests: null,
                max_guests: null,
                min_age: null,
                max_age: null,
                enabled: true,
                created_at: new Date().toISOString(),
              })}
              className="flex items-center gap-1.5 text-xs bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <Plus size={14} /> Adicionar Regra
            </button>
          </div>

          {discounts.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-3 bg-stone-50 rounded-lg">Nenhuma regra de desconto configurada.</p>
          ) : (
            <div className="space-y-2">
              {discounts.map(d => (
                <div key={d.id} className={`flex items-center justify-between gap-2 p-3 rounded-lg border ${d.enabled ? 'border-stone-200 bg-white' : 'border-stone-200 bg-stone-50 opacity-60'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-stone-800 truncate">{d.label || 'Sem nome'}</span>
                      <span className="text-xs text-stone-400">
                        {d.scope === 'period' ? 'Período' : 'Ocupação'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500">
                      {d.type === 'percentage' ? `${d.value}% de desconto` : `R$ ${d.value.toFixed(2)} por noite`}
                      {d.scope === 'period' && d.start_date && ` · ${new Date(d.start_date + 'T00:00').toLocaleDateString('pt-BR')}`}
                      {d.scope === 'period' && d.end_date && ` → ${new Date(d.end_date + 'T00:00').toLocaleDateString('pt-BR')}`}
                      {d.scope === 'occupancy' && d.min_guests != null && ` · min ${d.min_guests} hóspedes`}
                      {d.scope === 'occupancy' && d.max_guests != null && ` · max ${d.max_guests} hóspedes`}
                      {d.min_age != null && ` · idade ${d.min_age}+`}
                      {d.max_age != null && ` até ${d.max_age}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleDiscount(d.id)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${d.enabled ? 'bg-primary-500' : 'bg-stone-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${d.enabled ? 'translate-x-4' : ''}`} />
                    </button>
                    <button type="button" onClick={() => setEditingDiscount(d)} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                      <Settings size={14} className="text-stone-500" />
                    </button>
                    <button type="button" onClick={() => removeDiscount(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {editingDiscount && (
          <DiscountEditor
            discount={editingDiscount}
            onSave={addDiscount}
            onClose={() => setEditingDiscount(null)}
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors">Cancelar</button>
          <button
            onClick={() => onSave({ ...form, amenities: form.amenities.split(',').map(a => a.trim()).filter(Boolean), discounts })}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Save size={16} /> Salvar
          </button>
        </div>
      </div>
    </Modal>
  )
}

function DiscountEditor({ discount, onSave, onClose }: {
  discount: DiscountRule
  onSave: (d: DiscountRule) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<DiscountRule>(discount)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <h3 className="font-serif text-lg text-stone-800">Regra de Desconto</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100 transition-colors">
            <X size={18} className="text-stone-400" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Nome da regra">
            <input type="text" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className={inputCls} placeholder="Ex: Baixa temporada, Grupo 4+ pessoas" />
          </Field>
          <Field label="Tipo de critério">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, scope: 'period' })}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.scope === 'period' ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}
              >
                Período (Datas)
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, scope: 'occupancy' })}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.scope === 'occupancy' ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}
              >
                Ocupação (Hóspedes)
              </button>
            </div>
          </Field>
          <Field label="Tipo de desconto">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'percentage' })}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.type === 'percentage' ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}
              >
                Percentual (%)
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'fixed' })}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.type === 'fixed' ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}
              >
                Valor fixo (R$)
              </button>
            </div>
          </Field>
          <Field label={form.type === 'percentage' ? 'Desconto (%)' : 'Desconto por noite (R$)'}>
            <input
              type="number"
              min={0}
              step={form.type === 'percentage' ? '1' : '0.01'}
              value={form.value}
              onChange={e => setForm({ ...form, value: +e.target.value })}
              className={inputCls}
            />
          </Field>

          {form.scope === 'period' ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data inicial">
                <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Data final">
                <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className={inputCls} />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Mínimo de hóspedes">
                <input
                  type="number"
                  min={1}
                  value={form.min_guests ?? ''}
                  onChange={e => setForm({ ...form, min_guests: e.target.value ? +e.target.value : null })}
                  className={inputCls}
                  placeholder="Ex: 4"
                />
              </Field>
              <Field label="Máximo de hóspedes">
                <input
                  type="number"
                  min={1}
                  value={form.max_guests ?? ''}
                  onChange={e => setForm({ ...form, max_guests: e.target.value ? +e.target.value : null })}
                  className={inputCls}
                  placeholder="Ex: 10"
                />
              </Field>
            </div>
          )}

          <div className="border-t border-stone-100 pt-3">
            <p className="text-sm font-medium text-stone-600 mb-2">Filtro por idade (opcional — aplica apenas às crianças)</p>
            <p className="text-xs text-stone-400 mb-2">Se preenchido, o desconto se aplica somente às crianças cuja idade esteja no intervalo. Deixe em branco para aplicar a todos os hóspedes.</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Idade mínima">
                <input
                  type="number"
                  min={0}
                  max={17}
                  value={form.min_age ?? ''}
                  onChange={e => setForm({ ...form, min_age: e.target.value ? +e.target.value : null })}
                  className={inputCls}
                  placeholder="Ex: 0"
                />
              </Field>
              <Field label="Idade máxima">
                <input
                  type="number"
                  min={0}
                  max={17}
                  value={form.max_age ?? ''}
                  onChange={e => setForm({ ...form, max_age: e.target.value ? +e.target.value : null })}
                  className={inputCls}
                  placeholder="Ex: 12"
                />
              </Field>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={e => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-stone-300 text-primary-600 focus:ring-primary-400"
            />
            <span className="text-sm text-stone-600">Ativar esta regra</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors">Cancelar</button>
            <button
              type="button"
              onClick={() => onSave(form)}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Save size={16} /> Salvar Regra
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ ICAL TAB ============
function ICalTab({ rooms, feeds, onUpdate, onAddFeed, onDeleteFeed }: {
  rooms: Room[]
  feeds: ICalFeed[]
  onUpdate: () => void
  onAddFeed: (f: Partial<ICalFeed>) => void
  onDeleteFeed: (id: string) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [newFeed, setNewFeed] = useState({ room_id: '', source_name: '', feed_url: '' })
  const [syncing, setSyncing] = useState<string | null>(null)

  const roomName = (id: string) => rooms.find(r => r.id === id)?.name || '?'
  const icalUrl = (token: string) => `${window.location.origin}/ical-export?token=${token}`

  async function addFeed() {
    if (!newFeed.room_id || !newFeed.feed_url) return
    onAddFeed({ room_id: newFeed.room_id, source_name: newFeed.source_name || 'OTA', feed_url: newFeed.feed_url })
    setNewFeed({ room_id: '', source_name: '', feed_url: '' })
    setShowAdd(false)
    await onUpdate()
  }

  async function deleteFeed(id: string) {
    if (!confirm('Remover este feed?')) return
    onDeleteFeed(id)
    onUpdate()
  }

  async function syncFeed(feed: ICalFeed) {
    setSyncing(feed.id)
    setTimeout(() => {
      setSyncing(null)
      onUpdate()
    }, 500)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-serif text-xl text-stone-800">Sincronização iCal</h2>
          <p className="text-sm text-stone-500 mt-1">Gerencie feeds de Airbnb, Booking.com, TripLar e outras OTAs</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Importar iCal (URL Externa)
        </button>
      </div>

      <Card title="URLs de Exportação — Calendário Interno (cole no painel das OTAs)">
        <div className="space-y-3">
          {rooms.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-4">Crie quartos primeiro para gerar URLs de exportação.</p>
          ) : rooms.map(room => (
            <div key={room.id} className="flex items-center gap-2">
              <span className="text-sm font-medium text-stone-700 w-32 truncate">{room.name}:</span>
              <input
                type="text"
                readOnly
                value={icalUrl(room.ical_export_token)}
                className="flex-1 text-xs bg-stone-50 border border-stone-200 rounded px-2 py-1.5 text-stone-600 truncate"
                onClick={e => e.currentTarget.select()}
              />
              <button
                onClick={() => navigator.clipboard.writeText(icalUrl(room.ical_export_token))}
                className="text-xs bg-stone-100 hover:bg-stone-200 px-2 py-1.5 rounded transition-colors"
              >
                Copiar
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Feeds de Importação (${feeds.length})`}>
        {feeds.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-6">Nenhum feed configurado. Adicione o link .ics de cada OTA para importar bloqueios.</p>
        ) : (
          <div className="space-y-3">
            {feeds.map(feed => (
              <div key={feed.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-stone-200">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-stone-800 text-sm">{feed.source_name}</span>
                    <span className="text-xs text-stone-400">→ {roomName(feed.room_id)}</span>
                    {!feed.enabled && <span className="text-xs text-amber-600">Inativo</span>}
                  </div>
                  <p className="text-xs text-stone-400 truncate">{feed.feed_url}</p>
                  {feed.last_synced_at && (
                    <p className="text-xs text-stone-400 mt-0.5">
                      Última sincronização: {new Date(feed.last_synced_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => syncFeed(feed)}
                    disabled={syncing === feed.id}
                    className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={syncing === feed.id ? 'animate-spin' : ''} />
                    {syncing === feed.id ? 'Sincronizando...' : 'Sincronizar'}
                  </button>
                  <button onClick={() => deleteFeed(feed.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 size={16} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showAdd && (
        <Modal title="Importar iCal (URL Externa)" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            <Field label="Quarto">
              <select value={newFeed.room_id} onChange={e => setNewFeed({ ...newFeed, room_id: e.target.value })} className={inputCls}>
                <option value="">Selecione...</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="Origem (ex: Airbnb, Booking.com)">
              <input type="text" value={newFeed.source_name} onChange={e => setNewFeed({ ...newFeed, source_name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="URL do feed .ics (cole o link de exportação do canal terceiro)">
              <input type="url" value={newFeed.feed_url} onChange={e => setNewFeed({ ...newFeed, feed_url: e.target.value })} className={inputCls} placeholder="https://www.airbnb.com/calendar/ical/..." />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors">Cancelar</button>
              <button onClick={addFeed} className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">Adicionar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ============ SETTINGS TAB ============
function SettingsTab({ settings, users, onSave, onAddUser, onUpdateUser, onDeleteUser }: { settings: InnSettings | null; users: import('../lib/supabase').AppUser[]; onSave: (s: InnSettings) => Promise<boolean>; onAddUser: (u: { name: string; email: string; password: string }) => string | null; onUpdateUser: (id: string, u: Partial<import('../lib/supabase').AppUser>) => void; onDeleteUser: (id: string) => void }) {
  const [form, setForm] = useState<InnSettings | null>(settings)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const heroInputRef = useRef<HTMLInputElement>(null)
  const [logoDisplay, setLogoDisplay] = useState('')
  const [heroDisplay, setHeroDisplay] = useState<string[]>([])
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)

  useEffect(() => {
    setForm(settings)
    // Resolve media keys for display
    if (settings?.logo_url && settings.logo_url.startsWith('media:')) {
      idbGetAsObjectURL(settings.logo_url).then(url => setLogoDisplay(url || ''))
    } else {
      setLogoDisplay(settings?.logo_url || '')
    }
    const heroes = settings?.hero_images || []
    Promise.all(heroes.map(h => h.startsWith('media:') ? idbGetAsObjectURL(h) : h)).then(urls => setHeroDisplay(urls.filter(Boolean) as string[]))
  }, [settings])

  if (!form) return null

  async function save() {
    if (!form) return
    setSaving(true)
    setSaveResult(null)
    const ok = await onSave(form)
    setSaving(false)
    setSaveResult(ok ? 'success' : 'error')
    setTimeout(() => setSaveResult(null), 3000)
  }

  function update(key: keyof InnSettings, value: any) {
    setForm({ ...form!, [key]: value })
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setUploadingLogo(true)
    try {
      const compressed = await compressImage(file, 400, 0.8)
      const key = await storeMedia(compressed)
      update('logo_url', key)
      setLogoDisplay(compressed)
    } catch {
      alert('Falha ao processar a logo.')
    }
    setUploadingLogo(false)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setUploadingHero(true)
    try {
      const compressed = await compressImage(file, 1600, 0.7)
      const key = await storeMedia(compressed)
      const current = form?.hero_images || []
      update('hero_images', [...current, key])
      setHeroDisplay(prev => [...prev, compressed])
    } catch {
      alert('Falha ao processar a imagem.')
    }
    setUploadingHero(false)
    if (heroInputRef.current) heroInputRef.current.value = ''
  }

  async function removeHeroImage(idx: number) {
    const current = form?.hero_images || []
    const removed = current[idx]
    if (removed && removed.startsWith('media:')) {
      try { await idbDelete(removed) } catch {}
    }
    update('hero_images', current.filter((_, i) => i !== idx))
  }

  function clearField(key: keyof InnSettings) {
    update(key, '')
  }

  async function handleClearLogo() {
    const old = form?.logo_url
    if (old && old.startsWith('media:')) {
      try { await idbDelete(old) } catch {}
    }
    clearField('logo_url')
    setLogoDisplay('')
  }

  return (
    <div className="space-y-6">
      <Card title="Informações Principais">
        <Field label="Nome da Pousada">
          <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Descrição">
          <textarea rows={4} value={form.description} onChange={e => update('description', e.target.value)} className={inputCls} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Cidade"><input type="text" value={form.city} onChange={e => update('city', e.target.value)} className={inputCls} /></Field>
          <Field label="Estado"><input type="text" value={form.state} onChange={e => update('state', e.target.value)} className={inputCls} maxLength={2} /></Field>
        </div>
        <Field label="Endereço"><input type="text" value={form.address} onChange={e => update('address', e.target.value)} className={inputCls} /></Field>
      </Card>

      <Card title="Logo da Pousada">
        <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
        <div className="flex items-center gap-4">
          {logoDisplay ? (
            <img src={logoDisplay} alt="Logo" className="h-16 w-24 object-contain rounded-lg bg-stone-50 border border-stone-200 p-1" />
          ) : (
            <div className="h-16 w-24 rounded-lg bg-stone-50 border border-dashed border-stone-300 flex items-center justify-center text-stone-400 text-xs text-center">Sem logo</div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Upload size={16} /> {uploadingLogo ? 'Enviando...' : form.logo_url ? 'Trocar Logo' : 'Enviar Logo'}
            </button>
            {form.logo_url && (
              <button
                onClick={() => { handleClearLogo() }}
                className="flex items-center gap-2 bg-stone-100 hover:bg-red-50 text-stone-600 hover:text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 size={16} /> Remover
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card title="Imagens de Fundo (Carrossel do Banner)">
        <input ref={heroInputRef} type="file" accept="image/*" onChange={handleHeroUpload} className="hidden" />
        <p className="text-sm text-stone-500 -mt-2 mb-3">As imagens aparecerão em rotação automática no banner do site público. A primeira imagem também é usada como banner principal.</p>
        <button
          onClick={() => heroInputRef.current?.click()}
          disabled={uploadingHero}
          className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-stone-300 rounded-xl py-6 px-4 text-stone-500 hover:border-primary-400 hover:text-primary-600 transition-colors mb-4 disabled:opacity-60"
        >
          <Upload size={24} />
          <span className="text-sm font-medium">{uploadingHero ? 'Processando...' : 'Adicionar imagem ao carrossel'}</span>
          <span className="text-xs text-stone-400">PNG, JPG ou WEBP · compressão automática</span>
        </button>
        {heroDisplay.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {heroDisplay.map((img, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden h-28 bg-stone-100">
                <img src={img} alt={`Banner ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => { removeHeroImage(idx); setHeroDisplay(prev => prev.filter((_, i) => i !== idx)) }}
                  className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Contato e Redes Sociais">
        <div className="space-y-4">
          <ContactField label="E-mail" value={form.email} onChange={v => update('email', v)} onClear={() => clearField('email')} type="email" placeholder="contato@pousada.com.br" />
          <ContactField label="WhatsApp (com código do país, ex: 5511999999999)" value={form.whatsapp} onChange={v => update('whatsapp', v)} onClear={() => clearField('whatsapp')} />
          <ContactField label="Telefone fixo" value={form.phone} onChange={v => update('phone', v)} onClear={() => clearField('phone')} placeholder="(00) 0000-0000" />
          <ContactField label="Instagram (URL)" value={form.instagram_url} onChange={v => update('instagram_url', v)} onClear={() => clearField('instagram_url')} type="url" placeholder="https://instagram.com/..." />
          <ContactField label="Facebook (URL)" value={form.facebook_url} onChange={v => update('facebook_url', v)} onClear={() => clearField('facebook_url')} type="url" placeholder="https://facebook.com/..." />
        </div>
      </Card>

      <Card title="Chave Pix">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Tipo da Chave">
            <select value={form.pix_key_type} onChange={e => update('pix_key_type', e.target.value)} className={inputCls}>
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="E-mail">E-mail</option>
              <option value="Celular">Celular</option>
              <option value="Chave Aleatória">Chave Aleatória</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <ContactField label="Chave Pix" value={form.pix_key} onChange={v => update('pix_key', v)} onClear={() => clearField('pix_key')} />
          </div>
        </div>
      </Card>

      <OTALinksSection otaLinks={form.ota_links || []} onChange={(links) => update('ota_links', links)} />

      <Card title="Links de Reserva Rápidos (Booking, Airbnb, TripLar)">
        <p className="text-sm text-stone-500 -mt-2 mb-2">Atalhos fixos para as principais plataformas. Para adicionar mais plataformas, use a seção acima.</p>
        <div className="space-y-4">
          <ContactField label="Booking.com (URL)" value={form.booking_url} onChange={v => update('booking_url', v)} onClear={() => clearField('booking_url')} type="url" placeholder="https://www.booking.com/..." />
          <ContactField label="Airbnb (URL)" value={form.airbnb_url} onChange={v => update('airbnb_url', v)} onClear={() => clearField('airbnb_url')} type="url" placeholder="https://www.airbnb.com.br/..." />
          <ContactField label="TripLar (URL)" value={form.triplar_url} onChange={v => update('triplar_url', v)} onClear={() => clearField('triplar_url')} type="url" placeholder="https://www.triplar.com.br/..." />
        </div>
      </Card>

      <Card title="Localização e Mapa">
        <p className="text-sm text-stone-500 -mt-2 mb-2">Informe a latitude e longitude da pousada para mostrar o mapa e rotas no site público.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Latitude"><input type="text" value={form.maps_lat} onChange={e => update('maps_lat', e.target.value)} className={inputCls} placeholder="Ex: -23.5505" /></Field>
          <Field label="Longitude"><input type="text" value={form.maps_lng} onChange={e => update('maps_lng', e.target.value)} className={inputCls} placeholder="Ex: -46.6333" /></Field>
        </div>
        <p className="text-xs text-stone-400">Dica: acesse o Google Maps, clique com o botão direito no local e copie as coordenadas.</p>
      </Card>

      <Card title="Horários">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Check-in"><input type="time" value={form.check_in_time} onChange={e => update('check_in_time', e.target.value)} className={inputCls} /></Field>
          <Field label="Check-out"><input type="time" value={form.check_out_time} onChange={e => update('check_out_time', e.target.value)} className={inputCls} /></Field>
        </div>
      </Card>

      <UsersTab users={users} onAdd={onAddUser} onUpdate={onUpdateUser} onDelete={onDeleteUser} />

      <div className="flex items-center gap-3 justify-end">
        {saveResult === 'success' && <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><Check size={16} /> Salvo!</span>}
        {saveResult === 'error' && <span className="flex items-center gap-1.5 text-red-500 text-sm font-medium"><AlertCircle size={16} /> Erro</span>}
        <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white px-6 py-3 rounded-lg font-medium transition-colors">
          <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  )
}

function UsersTab({ users, onAdd, onUpdate, onDelete }: { users: import('../lib/supabase').AppUser[]; onAdd: (u: { name: string; email: string; password: string }) => string | null; onUpdate: (id: string, u: Partial<import('../lib/supabase').AppUser>) => void; onDelete: (id: string) => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  function submit() {
    if (!form.name || !form.email || (!editingId && !form.password)) { setMessage('Preencha nome, e-mail e senha.'); return }
    if (editingId) { onUpdate(editingId, { name: form.name, email: form.email, ...(form.password ? { password: form.password } : {}) }); setEditingId(null); setMessage('Usuário atualizado.') }
    else { const error = onAdd(form); setMessage(error || 'Usuário adicionado.') }
    setForm({ name: '', email: '', password: '' })
  }
  return <Card title="Gerenciamento de Usuários">
    <div className="grid sm:grid-cols-3 gap-3">
      <input placeholder="Nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
      <input type="email" placeholder="E-mail" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} />
      <input type="password" placeholder={editingId ? 'Nova senha (opcional)' : 'Senha'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inputCls} />
    </div>
    <button onClick={submit} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium">{editingId ? 'Salvar usuário' : 'Adicionar usuário'}</button>
    {message && <p className="text-sm text-stone-600">{message}</p>}
    <div className="space-y-2">
      {users.map(item => <div key={item.id} className="flex items-center justify-between gap-3 border border-stone-200 rounded-lg p-3">
        <div><p className="font-medium text-stone-800">{item.name}</p><p className="text-xs text-stone-500">{item.email}</p></div>
        <div className="flex gap-2"><button onClick={() => { setEditingId(item.id); setForm({ name: item.name, email: item.email, password: '' }) }} className="text-xs text-primary-600">Editar</button><button onClick={() => { if (confirm('Excluir este usuário?')) onDelete(item.id) }} className="text-xs text-red-500">Excluir</button></div>
      </div>)}
      {users.length === 0 && <p className="text-sm text-stone-400">Nenhum usuário cadastrado. Crie o primeiro acima.</p>}
    </div>
  </Card>
}

function OTALinksSection({ otaLinks, onChange }: { otaLinks: OTALink[]; onChange: (links: OTALink[]) => void }) {
  const platforms = ['Airbnb', 'Booking.com', 'Vrbo', 'Expedia', 'TripLar', 'Decolar', 'Hoteis.com', 'Outra']
  const [newLink, setNewLink] = useState({ platform: 'Airbnb', label: '', url: '' })

  function addLink() {
    if (!newLink.url.trim()) return
    const platform = newLink.platform === 'Outra' ? newLink.label || 'Outra' : newLink.platform
    const link: OTALink = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      platform,
      label: newLink.label || platform,
      url: newLink.url.trim(),
    }
    onChange([...otaLinks, link])
    setNewLink({ platform: 'Airbnb', label: '', url: '' })
  }

  function removeLink(id: string) {
    onChange(otaLinks.filter(l => l.id !== id))
  }

  function updateLink(id: string, field: keyof OTALink, value: string) {
    onChange(otaLinks.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const grouped = otaLinks.reduce<Record<string, OTALink[]>>((acc, link) => {
    const key = link.platform
    if (!acc[key]) acc[key] = []
    acc[key].push(link)
    return acc
  }, {})

  return (
    <Card title="Links de Reservas OTAs (Dinâmico)">
      <p className="text-sm text-stone-500 -mt-2 mb-2">Adicione até 50 links por plataforma (Airbnb, Booking.com, Vrbo, Expedia, etc.). Cada link pode ter um nome e URL próprios.</p>
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <select value={newLink.platform} onChange={e => setNewLink({ ...newLink, platform: e.target.value })} className={inputCls}>
          {platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="text" placeholder="Nome/Acomodação (opcional)" value={newLink.label} onChange={e => setNewLink({ ...newLink, label: e.target.value })} className={inputCls} />
        <input type="url" placeholder="URL do link" value={newLink.url} onChange={e => setNewLink({ ...newLink, url: e.target.value })} className={inputCls} />
      </div>
      <button onClick={addLink} disabled={!newLink.url.trim()} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors mb-4">
        <Plus size={16} /> Adicionar Link
      </button>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-stone-400 text-sm text-center py-4">Nenhum link OTA adicionado ainda.</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([platform, links]) => (
            <div key={platform} className="border border-stone-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-stone-800 text-sm">{platform} <span className="text-stone-400">({links.length}/50)</span></h3>
              </div>
              <div className="space-y-2">
                {links.map(link => (
                  <div key={link.id} className="flex items-center gap-2">
                    <input type="text" value={link.label} onChange={e => updateLink(link.id, 'label', e.target.value)} placeholder="Nome" className={`${inputCls} flex-1`} />
                    <input type="url" value={link.url} onChange={e => updateLink(link.id, 'url', e.target.value)} placeholder="URL" className={`${inputCls} flex-[2]`} />
                    <button onClick={() => removeLink(link.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function ContactField({ label, value, onChange, onClear, type = 'text', placeholder = '' }: {
  label: string
  value: string
  onChange: (v: string) => void
  onClear: () => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-600 mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
        {value && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 bg-stone-100 hover:bg-red-50 text-stone-500 hover:text-red-500 px-3 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
            title="Limpar"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ============ GALLERY TAB ============
function GalleryTab({ photos, onUpdate, onAddPhoto, onDeletePhoto }: { photos: GalleryPhoto[]; onUpdate: () => void; onAddPhoto: (url: string, caption: string) => Promise<boolean>; onDeletePhoto: (id: string) => void }) {
  const [newPhotoUrl, setNewPhotoUrl] = useState('')
  const [newPhotoCaption, setNewPhotoCaption] = useState('')
  const [adding, setAdding] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoKeys = photos.map(p => p.url)
  const resolvedPhotoUrls = useMediaUrls(photoKeys)
  const resolvedPhotos = photos.map((p, i) => ({ ...p, url: resolvedPhotoUrls[i] || p.url }))

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Selecione um arquivo de imagem.')
      return
    }
    try {
      const compressed = await compressImage(file, 1280, 0.7)
      setNewPhotoUrl(compressed)
    } catch {
      setUploadError('Não foi possível processar a imagem.')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function addPhoto() {
    if (!newPhotoUrl.trim()) return
    setAdding(true)
    const ok = await onAddPhoto(newPhotoUrl.trim(), newPhotoCaption.trim())
    setNewPhotoUrl('')
    setNewPhotoCaption('')
    onUpdate()
    setAdding(false)
    if (!ok) setUploadError('Falha ao salvar a foto. Tente novamente.')
  }

  async function deletePhoto(id: string) {
    onDeletePhoto(id)
    onUpdate()
  }

  return (
    <div className="space-y-6">
      <Card title="Adicionar Foto">
        <Field label="Enviar imagem do dispositivo">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-stone-300 rounded-xl py-8 px-4 text-stone-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
          >
            <Upload size={28} />
            <span className="text-sm font-medium">Clique para selecionar uma imagem</span>
            <span className="text-xs text-stone-400">PNG, JPG ou WEBP · compressão automática</span>
          </button>
        </Field>
        <Field label="Ou cole a URL de uma imagem da internet">
          <input type="url" value={newPhotoUrl.startsWith('data:') ? '' : newPhotoUrl} onChange={e => setNewPhotoUrl(e.target.value)} placeholder="https://exemplo.com/foto.jpg" className={inputCls} />
        </Field>
        {uploadError && (
          <p className="text-red-500 text-sm flex items-center gap-1">
            <AlertCircle size={14} /> {uploadError}
          </p>
        )}
        {newPhotoUrl && <div className="mt-2 rounded-lg overflow-hidden h-36 bg-stone-100"><img src={newPhotoUrl} alt="Preview" className="w-full h-full object-cover" /></div>}
        <Field label="Legenda (opcional)">
          <input type="text" value={newPhotoCaption} onChange={e => setNewPhotoCaption(e.target.value)} className={inputCls} onKeyDown={e => e.key === 'Enter' && addPhoto()} />
        </Field>
        <button onClick={addPhoto} disabled={(!newPhotoUrl.trim()) || adding} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> {adding ? 'Adicionando...' : 'Adicionar Foto'}
        </button>
      </Card>

      <Card title={`Fotos da Galeria (${resolvedPhotos.length})`}>
        {resolvedPhotos.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-8">Nenhuma foto ainda.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {resolvedPhotos.map(photo => (
              <div key={photo.id} className="relative group rounded-lg overflow-hidden aspect-square bg-stone-100">
                <img src={photo.url} alt={photo.caption} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                  <button onClick={() => { if (confirm('Remover?')) deletePhoto(photo.id) }} className="opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white w-10 h-10 rounded-full flex items-center justify-center transition-opacity">
                    <Trash2 size={18} />
                  </button>
                </div>
                {photo.caption && <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 truncate">{photo.caption}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ============ SHARED COMPONENTS ============
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
      {title && <h2 className="font-serif text-lg text-stone-800 mb-5">{title}</h2>}
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

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-stone-400 w-32 flex-shrink-0">{label}:</span>
      <span className="text-stone-800">{value}</span>
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-stone-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-serif text-lg text-stone-800">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100 transition-colors">
            <X size={20} className="text-stone-500" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

const inputCls = 'w-full border border-stone-200 rounded-lg px-3 py-2.5 text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-shadow'
