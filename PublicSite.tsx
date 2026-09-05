import { useEffect, useState, useMemo } from 'react'
import { useData, useMediaUrl, useMediaUrls } from '../lib/store'
import { InnSettings, GalleryPhoto } from '../lib/supabase'
import {
  MapPin, Mail, Phone, Clock, Instagram, Facebook,
  ChevronLeft, ChevronRight, X, Copy, Check, Navigation, ExternalLink
} from 'lucide-react'

const DEFAULT_HERO = 'https://images.pexels.com/photos/1268855/pexels-photo-1268855.jpeg?auto=compress&cs=tinysrgb&w=1600'

export default function PublicSite() {
  const { settings, photos, loading } = useData()
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [heroIdx, setHeroIdx] = useState(0)

  const logoUrl = useMediaUrl(settings?.logo_url || '')
  const heroKeys = useMemo(() => {
    const imgs: string[] = []
    if (settings?.hero_images && settings.hero_images.length > 0) imgs.push(...settings.hero_images)
    if (settings?.hero_image_url && imgs.length === 0) imgs.push(settings.hero_image_url)
    return imgs
  }, [settings?.hero_images, settings?.hero_image_url])
  const resolvedHeroes = useMediaUrls(heroKeys)
  const photoKeys = useMemo(() => photos.map(p => p.url), [photos])
  const resolvedPhotoUrls = useMediaUrls(photoKeys)
  const resolvedPhotos = useMemo(() => photos.map((p, i) => ({ ...p, url: resolvedPhotoUrls[i] || p.url })), [photos, resolvedPhotoUrls])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const heroImages: string[] = resolvedHeroes.length > 0 ? resolvedHeroes.filter(Boolean) : [DEFAULT_HERO]

  // Auto-rotate hero carousel every 6 seconds with random transition
  useEffect(() => {
    if (heroImages.length <= 1) return
    const interval = setInterval(() => {
      setHeroIdx(prev => {
        if (heroImages.length <= 1) return 0
        let next = Math.floor(Math.random() * heroImages.length)
        if (next === prev) next = (prev + 1) % heroImages.length
        return next
      })
    }, 6000)
    return () => clearInterval(interval)
  }, [heroImages.length])

  async function copyPix() {
    if (!settings?.pix_key) return
    await navigator.clipboard.writeText(settings.pix_key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function prevPhoto() {
    if (lightbox === null) return
    setLightbox((lightbox - 1 + resolvedPhotos.length) % resolvedPhotos.length)
  }
  function nextPhoto() {
    if (lightbox === null) return
    setLightbox((lightbox + 1) % resolvedPhotos.length)
  }

  const whatsappLink = settings?.whatsapp
    ? `https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`
    : null
  const phoneLink = settings?.phone
    ? `tel:${settings.phone.replace(/\D/g, '')}`
    : null
  const mapsQuery = [settings?.address, settings?.city, settings?.state].filter(Boolean).join(', ')
  const mapsLink = settings?.maps_lat && settings?.maps_lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${settings.maps_lat},${settings.maps_lng}`
    : mapsQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
      : null
  const wazeLink = settings?.maps_lat && settings?.maps_lng
    ? `https://www.waze.com/ul?ll=${settings.maps_lat}%2C${settings.maps_lng}&navigate=yes`
    : mapsQuery
      ? `https://www.waze.com/ul?q=${encodeURIComponent(mapsQuery)}&navigate=yes`
      : null
  const mapEmbedUrl = settings?.maps_lat && settings?.maps_lng
    ? `https://www.google.com/maps?q=${settings.maps_lat},${settings.maps_lng}&z=15&output=embed`
    : mapsQuery
      ? `https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&z=15&output=embed`
      : null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logoUrl || '/logo.svg'}
              alt="Logo da pousada"
              className={`h-10 w-14 object-contain rounded transition-all duration-300 ${scrolled ? 'bg-white/90 p-0.5' : 'bg-white/20 backdrop-blur p-0.5'}`}
            />
            <h1 className={`font-serif text-xl font-semibold transition-colors duration-300 ${scrolled ? 'text-stone-800' : 'text-white'}`}>
              {settings?.name || 'Pousada'}
            </h1>
          </div>
          <nav className="flex items-center gap-6">
            {['Início', 'Galeria', 'Contato'].map((item, i) => {
              const ids = ['hero', 'gallery', 'contact']
              return (
                <a
                  key={item}
                  href={`#${ids[i]}`}
                  className={`text-sm font-medium transition-colors duration-300 ${scrolled ? 'text-stone-600 hover:text-primary-600' : 'text-white/90 hover:text-white'}`}
                >
                  {item}
                </a>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Hero with background carousel */}
      <section id="hero" className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
        {heroImages.map((img, idx) => (
          <img
            key={idx}
            src={img}
            alt={`Banner ${idx + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === heroIdx ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />
        {heroImages.length > 1 && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {heroImages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setHeroIdx(idx)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === heroIdx ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/70'}`}
                aria-label={`Banner ${idx + 1}`}
              />
            ))}
          </div>
        )}
        <div className="relative z-10 text-center text-white px-4 max-w-3xl mx-auto">
          <h2 className="font-serif text-5xl sm:text-6xl font-bold mb-4 leading-tight">
            {settings?.name || 'Bem-vindo'}
          </h2>
          {settings?.city && (
            <p className="text-white/80 flex items-center justify-center gap-1 mb-6 text-sm">
              <MapPin size={14} />
              {settings.city}{settings.state ? `, ${settings.state}` : ''}
            </p>
          )}
          {settings?.description && (
            <p className="text-white/90 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
              {settings.description}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                WhatsApp
              </a>
            )}
            <a
              href="/reservar"
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-full text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Reservar Agora
            </a>
            <a
              href="#gallery"
              className="bg-white/20 hover:bg-white/30 backdrop-blur text-white border border-white/40 px-6 py-3 rounded-full text-sm font-medium transition-all duration-200"
            >
              Ver Galeria
            </a>
          </div>
        </div>
        <a href="#gallery" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 hover:text-white transition-colors animate-bounce">
          <ChevronLeft className="rotate-[-90deg]" size={28} />
        </a>
      </section>

      {/* Info Strip */}
      {(settings?.check_in_time || settings?.check_out_time) && (
        <section className="bg-primary-600 text-white py-4">
          <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-center gap-8 text-sm">
            {settings.check_in_time && (
              <div className="flex items-center gap-2">
                <Clock size={16} />
                <span>Check-in: <strong>{settings.check_in_time}</strong></span>
              </div>
            )}
            {settings.check_out_time && (
              <div className="flex items-center gap-2">
                <Clock size={16} />
                <span>Check-out: <strong>{settings.check_out_time}</strong></span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* About */}
      {settings?.description && (
        <section className="py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="font-serif text-3xl sm:text-4xl text-stone-800 mb-6">Sobre a Pousada</h2>
            <p className="text-stone-600 text-lg leading-relaxed">{settings.description}</p>
          </div>
        </section>
      )}

      {/* Gallery */}
      {resolvedPhotos.length > 0 && (
        <section id="gallery" className="py-20 bg-stone-50">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="font-serif text-3xl sm:text-4xl text-stone-800 text-center mb-12">Galeria</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {resolvedPhotos.map((photo, idx) => (
                <button
                  key={photo.id}
                  onClick={() => setLightbox(idx)}
                  className="relative aspect-square overflow-hidden rounded-lg group focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || `Foto ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {photo.caption && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-end">
                      <span className="text-white text-sm px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        {photo.caption}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-serif text-3xl sm:text-4xl text-stone-800 text-center mb-12">Contato</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {settings?.email && (
              <a
                href={`mailto:${settings.email}`}
                className="flex items-center gap-4 p-6 rounded-2xl border border-stone-200 hover:border-primary-300 hover:shadow-md transition-all duration-200 group"
              >
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                  <Mail className="text-primary-600" size={22} />
                </div>
                <div>
                  <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-0.5">E-mail</p>
                  <p className="text-stone-800 font-medium">{settings.email}</p>
                </div>
              </a>
            )}

            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-6 rounded-2xl border border-stone-200 hover:border-green-300 hover:shadow-md transition-all duration-200 group"
              >
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
                  <Phone className="text-green-600" size={22} />
                </div>
                <div>
                  <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-0.5">WhatsApp</p>
                  <p className="text-stone-800 font-medium">{settings?.whatsapp}</p>
                </div>
              </a>
            )}

            {phoneLink && (
              <a
                href={phoneLink}
                className="flex items-center gap-4 p-6 rounded-2xl border border-stone-200 hover:border-primary-300 hover:shadow-md transition-all duration-200 group"
              >
                <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                  <Phone className="text-primary-600" size={22} />
                </div>
                <div>
                  <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-0.5">Telefone</p>
                  <p className="text-stone-800 font-medium">{settings?.phone}</p>
                </div>
              </a>
            )}

            {settings?.pix_key && (
              <div className="flex items-center gap-4 p-6 rounded-2xl border border-stone-200 sm:col-span-2">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold text-sm">PIX</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-0.5">
                    {settings.pix_key_type || 'Chave Pix'}
                  </p>
                  <p className="text-stone-800 font-medium truncate">{settings.pix_key}</p>
                </div>
                <button
                  onClick={copyPix}
                  className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0"
                >
                  {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            )}

            {settings?.address && (
              <div className="flex items-center gap-4 p-6 rounded-2xl border border-stone-200 sm:col-span-2">
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="text-stone-600" size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-0.5">Endereço</p>
                  <p className="text-stone-800 font-medium">
                    {settings.address}
                    {settings.city && `, ${settings.city}`}
                    {settings.state && ` - ${settings.state}`}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {mapsLink && (
                      <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                        <Navigation size={14} /> Rota no Google Maps
                      </a>
                    )}
                    {wazeLink && (
                      <a href={wazeLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                        <Navigation size={14} /> Rota no Waze
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {(() => {
            const fixedLinks: [string, string | undefined][] = [
              ['Booking.com', settings?.booking_url],
              ['Airbnb', settings?.airbnb_url],
              ['TripLar', settings?.triplar_url],
            ].filter(([, url]) => url) as [string, string | undefined][]

            const dynamicLinks = (settings?.ota_links || []).filter(l => l.url)

            if (fixedLinks.length === 0 && dynamicLinks.length === 0) return null

            return (
              <div className="mt-8 pt-8 border-t border-stone-200">
                <p className="text-xs text-stone-500 font-medium uppercase tracking-wider text-center mb-4">Reserve também por</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {fixedLinks.map(([label, url]) => (
                    <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 border border-stone-200 hover:border-primary-300 hover:shadow-sm text-stone-700 px-4 py-2 rounded-lg text-sm font-medium transition-all">
                      <ExternalLink size={14} /> {label}
                    </a>
                  ))}
                  {dynamicLinks.map(link => (
                    <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 border border-stone-200 hover:border-primary-300 hover:shadow-sm text-stone-700 px-4 py-2 rounded-lg text-sm font-medium transition-all">
                      <ExternalLink size={14} /> {link.label || link.platform}
                    </a>
                  ))}
                </div>
              </div>
            )
          })()}

          {(settings?.instagram_url || settings?.facebook_url) && (
            <div className="flex items-center justify-center gap-4 mt-10">
              {settings.instagram_url && (
                <a
                  href={settings.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 rounded-full bg-stone-100 hover:bg-pink-100 flex items-center justify-center transition-colors group"
                >
                  <Instagram size={22} className="text-stone-600 group-hover:text-pink-600 transition-colors" />
                </a>
              )}
              {settings.facebook_url && (
                <a
                  href={settings.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 rounded-full bg-stone-100 hover:bg-blue-100 flex items-center justify-center transition-colors group"
                >
                  <Facebook size={22} className="text-stone-600 group-hover:text-blue-600 transition-colors" />
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {mapEmbedUrl && (
        <section className="bg-stone-50 py-20">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="font-serif text-3xl sm:text-4xl text-stone-800 text-center mb-8">Como chegar</h2>
            <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-sm bg-white">
              <iframe
                title="Localização da pousada"
                src={mapEmbedUrl}
                className="w-full h-80 sm:h-96 border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="flex justify-center gap-3 mt-5">
              {mapsLink && <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"><Navigation size={16} /> Abrir no Google Maps</a>}
              {wazeLink && <a href={wazeLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"><Navigation size={16} /> Abrir no Waze</a>}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-stone-800 text-stone-400 py-8 text-center text-sm">
        <div className="max-w-6xl mx-auto px-4 space-y-2">
          <img src={logoUrl || '/logo.svg'} alt="Logo da pousada" className="h-10 w-16 object-contain mx-auto mb-2 opacity-80" />
          <p>© {new Date().getFullYear()} {settings?.name || 'Pousada'}. Todos os direitos reservados.</p>
          {(settings?.email || settings?.phone || whatsappLink) && (
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-stone-500">
              {settings?.email && <a href={`mailto:${settings.email}`} className="hover:text-stone-300 transition-colors">{settings.email}</a>}
              {settings?.phone && <a href={phoneLink!} className="hover:text-stone-300 transition-colors">{settings.phone}</a>}
              {whatsappLink && <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="hover:text-stone-300 transition-colors">WhatsApp</a>}
            </div>
          )}
          {(settings?.instagram_url || settings?.facebook_url) && (
            <div className="flex items-center justify-center gap-3 pt-2">
              {settings?.instagram_url && (
                <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-stone-300 transition-colors">
                  <Instagram size={18} />
                </a>
              )}
              {settings?.facebook_url && (
                <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="hover:text-stone-300 transition-colors">
                  <Facebook size={18} />
                </a>
              )}
            </div>
          )}
        </div>
      </footer>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X size={28} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); prevPhoto() }}
            className="absolute left-4 text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft size={40} />
          </button>
          <img
            src={resolvedPhotos[lightbox].url}
            alt={resolvedPhotos[lightbox].caption}
            className="max-h-[85vh] max-w-full rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => { e.stopPropagation(); nextPhoto() }}
            className="absolute right-4 text-white/70 hover:text-white transition-colors"
          >
            <ChevronRight size={40} />
          </button>
          {resolvedPhotos[lightbox].caption && (
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/40 px-4 py-2 rounded-full">
              {resolvedPhotos[lightbox].caption}
            </p>
          )}
        </div>
      )}

      {/* WhatsApp floating button */}
      {whatsappLink && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-40 bg-green-500 hover:bg-green-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
          title="Fale pelo WhatsApp"
        >
          <Phone size={24} />
        </a>
      )}
    </div>
  )
}
