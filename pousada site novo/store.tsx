import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import type { InnSettings, GalleryPhoto, Room, Reservation, ICalFeed, AppUser, DiscountRule } from './supabase'
import { idbSet, idbGetAsObjectURL, idbDelete, isMediaKey } from './idb-storage'

type DataState = {
  settings: InnSettings | null
  photos: GalleryPhoto[]
  rooms: Room[]
  reservations: Reservation[]
  feeds: ICalFeed[]
  users: AppUser[]
  loading: boolean
  reload: () => void
  saveSettings: (s: InnSettings) => Promise<boolean>
  addPhoto: (url: string, caption: string) => Promise<boolean>
  deletePhoto: (id: string) => void
  addRoom: (r: Partial<Room>) => void
  updateRoom: (id: string, r: Partial<Room>) => void
  deleteRoom: (id: string) => void
  addReservation: (r: Partial<Reservation>) => void
  updateReservation: (id: string, r: Partial<Reservation>) => void
  deleteReservation: (id: string) => void
  addFeed: (f: Partial<ICalFeed>) => void
  deleteFeed: (id: string) => void
  addUser: (u: { name: string; email: string; password: string }) => string | null
  updateUser: (id: string, u: Partial<AppUser>) => void
  deleteUser: (id: string) => void
  resolveMedia: (key: string) => Promise<string>
  storeMedia: (dataURL: string) => Promise<string>
}

const DataContext = createContext<DataState | undefined>(undefined)

const LS_KEY = 'pousada_data_v3'

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function token(): string {
  return uid() + uid()
}

function defaultSettings(): InnSettings {
  return {
    id: uid(),
    name: 'Pousada',
    description: '',
    email: '',
    whatsapp: '',
    pix_key: '',
    pix_key_type: 'CPF',
    address: '',
    city: '',
    state: '',
    instagram_url: '',
    facebook_url: '',
    phone: '',
    booking_url: '',
    airbnb_url: '',
    triplar_url: '',
    ota_links: [],
    maps_lat: '',
    maps_lng: '',
    check_in_time: '14:00',
    check_out_time: '12:00',
    hero_image_url: '',
    hero_images: [],
    logo_url: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

type StoredData = {
  settings: InnSettings
  photos: GalleryPhoto[]
  rooms: Room[]
  reservations: Reservation[]
  feeds: ICalFeed[]
  users: AppUser[]
}

function loadData(): StoredData {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        settings: { ...defaultSettings(), ...parsed.settings },
        photos: parsed.photos || [],
        rooms: (parsed.rooms || []).map((r: Room) => ({ ...r, discounts: (r.discounts || []).map((d: DiscountRule) => ({ ...d, min_age: d.min_age ?? null, max_age: d.max_age ?? null })) })),
        reservations: (parsed.reservations || []).map((r: Reservation) => ({ ...r, children_ages: r.children_ages || [] })),
        feeds: parsed.feeds || [],
        users: parsed.users || [],
      }
    }
  } catch {
    // corrupt data — start fresh
  }
  return {
    settings: defaultSettings(),
    photos: [],
    rooms: [],
    reservations: [],
    feeds: [],
    users: [],
  }
}

function saveData(data: StoredData): boolean {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

// --- Image compression ---

export function compressImage(file: File, maxWidth = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth || height > maxWidth) {
          if (width >= height) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          } else {
            width = Math.round((width * maxWidth) / height)
            height = maxWidth
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas não suportado')); return }
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error('Falha ao carregar imagem.'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'))
    reader.readAsDataURL(file)
  })
}

function dataURLtoBlob(dataURL: string): Blob {
  const [meta, base64] = dataURL.split(',')
  const mime = meta.match(/data:(.*?);/)?.[1] || 'image/jpeg'
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export async function storeMedia(dataURL: string): Promise<string> {
  const key = `media:${uid()}`
  const blob = dataURLtoBlob(dataURL)
  await idbSet(key, blob)
  return key
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StoredData>(() => loadData())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [])

  // Media resolution cache: mediaKey -> objectURL
  const mediaCache = useRef(new Map<string, string>()).current

  const resolveMedia = useCallback(async (key: string): Promise<string> => {
    if (!key) return ''
    if (!isMediaKey(key)) return key
    if (mediaCache.has(key)) return mediaCache.get(key)!
    const url = await idbGetAsObjectURL(key)
    if (url) mediaCache.set(key, url)
    return url || ''
  }, [mediaCache])

  const storeMedia = useCallback(async (dataURL: string): Promise<string> => {
    const key = `media:${uid()}`
    const blob = dataURLtoBlob(dataURL)
    await idbSet(key, blob)
    const objURL = URL.createObjectURL(blob)
    mediaCache.set(key, objURL)
    return key
  }, [mediaCache])

  const reload = useCallback(() => {
    setData(loadData())
  }, [])

  const saveSettings = useCallback(async (s: InnSettings): Promise<boolean> => {
    setData(prev => {
      const next = { ...prev, settings: { ...s, updated_at: new Date().toISOString() } }
      saveData(next)
      return next
    })
    return true
  }, [])

  const addPhoto = useCallback(async (url: string, caption: string): Promise<boolean> => {
    let storedUrl = url
    if (url.startsWith('data:')) {
      try {
        storedUrl = await storeMedia(url)
      } catch {
        return false
      }
    }
    const photo: GalleryPhoto = {
      id: uid(),
      url: storedUrl,
      caption,
      sort_order: 0,
      created_at: new Date().toISOString(),
    }
    setData(prev => {
      photo.sort_order = prev.photos.length
      const next = { ...prev, photos: [...prev.photos, photo] }
      saveData(next)
      return next
    })
    return true
  }, [storeMedia])

  const deletePhoto = useCallback((id: string) => {
    setData(prev => {
      const photo = prev.photos.find(p => p.id === id)
      if (photo && isMediaKey(photo.url)) {
        idbDelete(photo.url).catch(() => {})
      }
      const next = { ...prev, photos: prev.photos.filter(p => p.id !== id) }
      saveData(next)
      return next
    })
  }, [])

  const addRoom = useCallback((r: Partial<Room>) => {
    setData(prev => {
      const room: Room = {
        id: uid(),
        name: r.name || 'Novo Quarto',
        description: r.description || '',
        max_adults: r.max_adults ?? 2,
        max_children: r.max_children ?? 0,
        base_price: r.base_price ?? 0,
        amenities: r.amenities || [],
        status: r.status || 'available',
        min_stay: r.min_stay ?? 1,
        discounts: r.discounts || [],
        ical_export_token: token(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const next = { ...prev, rooms: [...prev.rooms, room] }
      saveData(next)
      return next
    })
  }, [])

  const updateRoom = useCallback((id: string, r: Partial<Room>) => {
    setData(prev => {
      const next = {
        ...prev,
        rooms: prev.rooms.map(room =>
          room.id === id ? { ...room, ...r, updated_at: new Date().toISOString() } : room
        ),
      }
      saveData(next)
      return next
    })
  }, [])

  const deleteRoom = useCallback((id: string) => {
    setData(prev => {
      const next = {
        ...prev,
        rooms: prev.rooms.filter(r => r.id !== id),
        reservations: prev.reservations.filter(res => res.room_id !== id),
      }
      saveData(next)
      return next
    })
  }, [])

  const addReservation = useCallback((r: Partial<Reservation>) => {
    setData(prev => {
      const res: Reservation = {
        id: uid(),
        room_id: r.room_id || '',
        guest_name: r.guest_name || '',
        guest_document: r.guest_document || '',
        guest_email: r.guest_email || '',
        guest_phone: r.guest_phone || '',
        guest_birth_date: r.guest_birth_date || null,
        check_in: r.check_in || '',
        check_out: r.check_out || '',
        num_adults: r.num_adults ?? 1,
        num_children: r.num_children ?? 0,
        children_ages: r.children_ages || [],
        arrival_time: r.arrival_time || '',
        observations: r.observations || '',
        accepted_terms: r.accepted_terms ?? false,
        status: r.status || 'pending',
        source: r.source || 'direct',
        total_price: r.total_price ?? null,
        ical_uid: r.ical_uid || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const next = { ...prev, reservations: [...prev.reservations, res] }
      saveData(next)
      return next
    })
  }, [])

  const updateReservation = useCallback((id: string, r: Partial<Reservation>) => {
    setData(prev => {
      const next = {
        ...prev,
        reservations: prev.reservations.map(res =>
          res.id === id ? { ...res, ...r, updated_at: new Date().toISOString() } : res
        ),
      }
      saveData(next)
      return next
    })
  }, [])

  const deleteReservation = useCallback((id: string) => {
    setData(prev => {
      const next = { ...prev, reservations: prev.reservations.filter(r => r.id !== id) }
      saveData(next)
      return next
    })
  }, [])

  const addFeed = useCallback((f: Partial<ICalFeed>) => {
    setData(prev => {
      const feed: ICalFeed = {
        id: uid(),
        room_id: f.room_id || '',
        source_name: f.source_name || 'OTA',
        feed_url: f.feed_url || '',
        last_synced_at: null,
        enabled: true,
        created_at: new Date().toISOString(),
      }
      const next = { ...prev, feeds: [...prev.feeds, feed] }
      saveData(next)
      return next
    })
  }, [])

  const deleteFeed = useCallback((id: string) => {
    setData(prev => {
      const next = { ...prev, feeds: prev.feeds.filter(f => f.id !== id) }
      saveData(next)
      return next
    })
  }, [])

  const addUser = useCallback((u: { name: string; email: string; password: string }): string | null => {
    let error: string | null = null
    setData(prev => {
      if (prev.users.some(usr => usr.email.toLowerCase() === u.email.toLowerCase())) {
        error = 'Este e-mail já está cadastrado.'
        return prev
      }
      const user: AppUser = {
        id: uid(),
        name: u.name,
        email: u.email,
        password: u.password,
        created_at: new Date().toISOString(),
      }
      const next = { ...prev, users: [...prev.users, user] }
      saveData(next)
      return next
    })
    return error
  }, [])

  const updateUser = useCallback((id: string, u: Partial<AppUser>) => {
    setData(prev => {
      const next = {
        ...prev,
        users: prev.users.map(usr => (usr.id === id ? { ...usr, ...u } : usr)),
      }
      saveData(next)
      return next
    })
  }, [])

  const deleteUser = useCallback((id: string) => {
    setData(prev => {
      const next = { ...prev, users: prev.users.filter(u => u.id !== id) }
      saveData(next)
      return next
    })
  }, [])

  return (
    <DataContext.Provider value={{
      settings: data.settings,
      photos: data.photos,
      rooms: data.rooms,
      reservations: data.reservations,
      feeds: data.feeds,
      users: data.users,
      loading,
      reload,
      saveSettings,
      addPhoto,
      deletePhoto,
      addRoom,
      updateRoom,
      deleteRoom,
      addReservation,
      updateReservation,
      deleteReservation,
      addFeed,
      deleteFeed,
      addUser,
      updateUser,
      deleteUser,
      resolveMedia,
      storeMedia,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

export function hasOverbooking(
  reservations: Reservation[],
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeId?: string
): boolean {
  return reservations.some(r =>
    r.room_id === roomId &&
    r.status !== 'cancelled' &&
    (excludeId ? r.id !== excludeId : true) &&
    checkIn < r.check_out &&
    checkOut > r.check_in
  )
}

export type PriceBreakdown = {
  adultCount: number
  adultUnitPrice: number
  adultSubtotal: number
  groupDiscount: number
  child04Count: number
  child04Subtotal: number
  child410Count: number
  child410UnitPrice: number
  child410Subtotal: number
  nights: number
  total: number
}

export function getPriceBreakdown(
  basePrice: number,
  numAdults: number,
  numChildren: number,
  checkIn: string,
  checkOut: string,
  childrenAges: number[] = []
): PriceBreakdown {
  const nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
  if (nights <= 0) {
    return { adultCount: 0, adultUnitPrice: basePrice, adultSubtotal: 0, groupDiscount: 0, child04Count: 0, child04Subtotal: 0, child410Count: 0, child410UnitPrice: basePrice * 0.75, child410Subtotal: 0, nights: 0, total: 0 }
  }

  let child04Count = 0
  let child410Count = 0
  let extraAdultsFromChildren = 0

  for (let i = 0; i < numChildren; i++) {
    const age = childrenAges[i] ?? 0
    if (age <= 3) child04Count++
    else if (age <= 10) child410Count++
    else extraAdultsFromChildren++
  }

  const totalAdults = numAdults + extraAdultsFromChildren
  const adultUnitPrice = basePrice
  const adultFullSubtotal = adultUnitPrice * totalAdults * nights
  const groupDiscount = totalAdults > 1
    ? adultUnitPrice * 0.10 * (totalAdults - 1) * nights
    : 0
  const adultSubtotal = adultFullSubtotal - groupDiscount

  const child410UnitPrice = basePrice * 0.75
  const child410Subtotal = child410UnitPrice * child410Count * nights

  const child04Subtotal = 0

  const total = adultSubtotal + child410Subtotal + child04Subtotal

  return {
    adultCount: totalAdults,
    adultUnitPrice,
    adultSubtotal,
    groupDiscount,
    child04Count,
    child04Subtotal,
    child410Count,
    child410UnitPrice,
    child410Subtotal,
    nights,
    total,
  }
}

export function calculateTotalPrice(
  basePrice: number,
  numAdults: number,
  numChildren: number,
  checkIn: string,
  checkOut: string,
  _discounts: DiscountRule[] = [],
  childrenAges: number[] = []
): number {
  return getPriceBreakdown(basePrice, numAdults, numChildren, checkIn, checkOut, childrenAges).total
}

export function getApplicableDiscounts(
  _basePrice: number,
  numAdults: number,
  numChildren: number,
  checkIn: string,
  checkOut: string,
  _discounts: DiscountRule[] = [],
  childrenAges: number[] = []
): { rule: { id: string; label: string }; amount: number }[] {
  const bd = getPriceBreakdown(_basePrice, numAdults, numChildren, checkIn, checkOut, childrenAges)
  const result: { rule: { id: string; label: string }; amount: number }[] = []
  if (bd.groupDiscount > 0) {
    result.push({ rule: { id: 'group', label: 'Desconto de Grupo (10% por adulto adicional)' }, amount: bd.groupDiscount })
  }
  if (bd.child410Count > 0) {
    const fullChildPrice = _basePrice * bd.child410Count * bd.nights
    result.push({ rule: { id: 'child410', label: 'Desconto Crianças 4-10 anos (25%)' }, amount: fullChildPrice - bd.child410Subtotal })
  }
  if (bd.child04Count > 0) {
    result.push({ rule: { id: 'child04', label: 'Crianças 0-3 anos (100%)' }, amount: _basePrice * bd.child04Count * bd.nights })
  }
  return result
}

export function useMediaUrl(key: string | undefined): string {
  const { resolveMedia } = useData()
  const [url, setUrl] = useState('')
  useEffect(() => {
    let cancelled = false
    if (!key) { setUrl(''); return }
    if (!isMediaKey(key)) { setUrl(key); return }
    resolveMedia(key).then(u => { if (!cancelled) setUrl(u) })
    return () => { cancelled = true }
  }, [key, resolveMedia])
  return url
}

export function useMediaUrls(keys: string[]): string[] {
  const { resolveMedia } = useData()
  const [urls, setUrls] = useState<string[]>(() => keys.map(k => isMediaKey(k) ? '' : k))
  const keysKey = keys.join(',')
  useEffect(() => {
    let cancelled = false
    Promise.all(keys.map(k => isMediaKey(k) ? resolveMedia(k) : k)).then(resolved => {
      if (!cancelled) setUrls(resolved)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysKey, resolveMedia])
  return urls
}
