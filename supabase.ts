export type OTALink = {
  id: string
  platform: string
  label: string
  url: string
}

export type DiscountType = 'percentage' | 'fixed'
export type DiscountScope = 'period' | 'occupancy'

export type DiscountRule = {
  id: string
  label: string
  scope: DiscountScope
  type: DiscountType
  value: number
  start_date: string
  end_date: string
  min_guests: number | null
  max_guests: number | null
  min_age: number | null
  max_age: number | null
  enabled: boolean
  created_at: string
}

export type InnSettings = {
  id: string
  name: string
  description: string
  email: string
  whatsapp: string
  pix_key: string
  pix_key_type: string
  address: string
  city: string
  state: string
  instagram_url: string
  facebook_url: string
  phone: string
  booking_url: string
  airbnb_url: string
  triplar_url: string
  ota_links: OTALink[]
  maps_lat: string
  maps_lng: string
  check_in_time: string
  check_out_time: string
  hero_image_url: string
  hero_images: string[]
  logo_url: string
  created_at: string
  updated_at: string
}

export type GalleryPhoto = {
  id: string
  url: string
  caption: string
  sort_order: number
  created_at: string
}

export type Room = {
  id: string
  name: string
  description: string
  max_adults: number
  max_children: number
  base_price: number
  amenities: string[]
  status: 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'active'
  min_stay: number
  discounts: DiscountRule[]
  ical_export_token: string
  created_at: string
  updated_at: string
}

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'blocked'
export type ReservationSource = 'direct' | 'airbnb' | 'booking' | 'triplar' | 'manual' | 'ical_import'

export type Reservation = {
  id: string
  room_id: string
  guest_name: string
  guest_document: string
  guest_email: string
  guest_phone: string
  guest_birth_date: string | null
  check_in: string
  check_out: string
  num_adults: number
  num_children: number
  children_ages: number[]
  arrival_time: string
  observations: string
  accepted_terms: boolean
  status: ReservationStatus
  source: ReservationSource
  total_price: number | null
  ical_uid: string | null
  created_at: string
  updated_at: string
}

export type ICalFeed = {
  id: string
  room_id: string
  source_name: string
  feed_url: string
  last_synced_at: string | null
  enabled: boolean
  created_at: string
}

export type PublicRoom = {
  id: string
  name: string
  max_adults: number
  max_children: number
  base_price: number
}

export const STATUS_COLORS: Record<ReservationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  confirmed: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
  blocked: 'bg-blue-100 text-blue-800 border-blue-300',
}

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  blocked: 'Bloqueado',
}

export const SOURCE_LABELS: Record<ReservationSource, string> = {
  direct: 'Direto',
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  triplar: 'TripLar',
  manual: 'Manual',
  ical_import: 'iCal Import',
}

export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'active'

export const ROOM_STATUS_LABELS: Record<string, string> = {
  available: 'Disponível',
  occupied: 'Ocupado',
  maintenance: 'Manutenção',
  cleaning: 'Limpeza',
  active: 'Disponível',
}

export const ROOM_STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  occupied: 'bg-red-100 text-red-700',
  maintenance: 'bg-amber-100 text-amber-700',
  cleaning: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
}

export type AppUser = {
  id: string
  name: string
  email: string
  password: string
  created_at: string
}
