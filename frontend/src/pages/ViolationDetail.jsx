import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Gauge, Calendar, Car, ShieldCheck,
  Phone, Cigarette, AlertTriangle, CheckCircle2, XCircle,
  Clock, Loader2, ExternalLink,
} from 'lucide-react'
import { violations as violationsApi, admin as adminApi } from '../services/api'
import { getUser } from '../utils/auth'
import { fmtDate } from '../utils/format'
import { formatPlate } from '../utils/plate'
import AiBadge from '../components/AiBadge'
import ViolationPills from '../components/ViolationPills'

function rolePath(role) {
  if (role === 'admin')  return '/admin'
  if (role === 'police') return '/police'
  return '/dashboard'
}

function DetailRow({ icon, label, value, mono }) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-700/50 last:border-0">
      <div className="text-slate-500 mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className={`text-sm text-white break-words ${mono ? 'font-mono tracking-wide' : 'font-medium'}`}>
          {value}
        </p>
      </div>
    </div>
  )
}

function AiRow({ icon, label, detected }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border
      ${detected
        ? 'bg-red-500/10 border-red-500/30'
        : 'bg-green-500/10 border-green-500/30'}`}>
      <div className="flex items-center gap-2.5 text-sm font-medium text-slate-200">
        {icon}
        {label}
      </div>
      {detected
        ? <span className="flex items-center gap-1 text-xs font-semibold text-red-400"><XCircle className="w-4 h-4" />Tespit Edildi</span>
        : <span className="flex items-center gap-1 text-xs font-semibold text-green-400"><CheckCircle2 className="w-4 h-4" />Temiz</span>}
    </div>
  )
}

export default function ViolationDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const user       = getUser()
  const [violation, setViolation] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    async function load() {
      try {
        let res
        if (user?.role === 'admin') {
          res = await adminApi.getViolationDetail(id)
        } else {
          res = await violationsApi.getViolationDetail(id)
        }
        setViolation(res.data.data)
      } catch (e) {
        const status = e.response?.status
        if (status === 403) setError('Bu ihlali görüntüleme yetkiniz yok.')
        else if (status === 404) setError('İhlal bulunamadı.')
        else setError('İhlal yüklenirken bir hata oluştu.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, user?.role])

  const backPath = rolePath(user?.role)
  const vt       = violation?.violation_type || {}
  const hasAi    = violation?.ai_status === 'completed'
  const mapUrl   = violation?.latitude && violation?.longitude
    ? `https://maps.google.com/?q=${violation.latitude},${violation.longitude}`
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="relative max-w-2xl mx-auto px-4 py-8">
        {/* Geri butonu */}
        <Link to={backPath}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition">
          <ArrowLeft className="w-4 h-4" />
          Geri dön
        </Link>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-300 font-medium">{error}</p>
            <button onClick={() => navigate(backPath)}
              className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition">
              Panele dön
            </button>
          </div>
        )}

        {violation && (
          <div className="space-y-4">
            {/* Başlık */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">İhlal #{violation.id}</h1>
                <p className="text-slate-400 text-sm mt-0.5">{fmtDate(violation.created_at)}</p>
              </div>
              <AiBadge status={violation.ai_status} />
            </div>

            {/* Fotoğraf */}
            {violation.photo_url && (
              <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-900">
                <img
                  src={violation.photo_url}
                  alt={`İhlal #${violation.id}`}
                  className="w-full object-cover max-h-80"
                  onError={e => { e.target.style.display = 'none' }}
                />
              </div>
            )}

            {/* AI ihlal pilleri */}
            {hasAi && (
              <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">AI Analiz Sonucu</h2>
                <div className="space-y-2">
                  <AiRow icon={<Phone className="w-4 h-4" />}       label="Telefon kullanımı"  detected={vt.phone} />
                  <AiRow icon={<Cigarette className="w-4 h-4" />}   label="Sigara içme"         detected={vt.smoking} />
                  <AiRow icon={<ShieldCheck className="w-4 h-4" />} label="Emniyet kemeri"      detected={vt.no_seatbelt} />
                  {violation.speed != null && (
                    <AiRow icon={<Gauge className="w-4 h-4" />}
                      label={`Hız ihlali${violation.speed_limit ? ` (limit: ${violation.speed_limit} km/h)` : ''}`}
                      detected={violation.speed_limit ? violation.speed > violation.speed_limit : false} />
                  )}
                </div>
              </div>
            )}

            {violation.ai_status === 'pending' && (
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 flex items-center gap-3">
                <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <p className="text-slate-300 text-sm">AI analizi henüz tamamlanmadı. Lütfen daha sonra tekrar kontrol edin.</p>
              </div>
            )}

            {violation.ai_status === 'failed' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-slate-300 text-sm">AI analizi başarısız oldu.</p>
              </div>
            )}

            {/* Detaylar */}
            <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-1 uppercase tracking-wider">İhlal Detayları</h2>
              <div className="divide-y divide-slate-700/50">
                <DetailRow
                  icon={<Car className="w-4 h-4" />}
                  label="Plaka"
                  value={formatPlate(violation.plate)}
                  mono
                />
                {violation.vehicle && (
                  <DetailRow
                    icon={<Car className="w-4 h-4" />}
                    label="Araç"
                    value={`${violation.vehicle.brand} ${violation.vehicle.model} (${violation.vehicle.year})`}
                  />
                )}
                <DetailRow
                  icon={<MapPin className="w-4 h-4" />}
                  label="Konum"
                  value={violation.location}
                />
                {violation.speed != null && (
                  <DetailRow
                    icon={<Gauge className="w-4 h-4" />}
                    label="Hız"
                    value={`${violation.speed} km/h${violation.speed_limit ? ` (limit: ${violation.speed_limit} km/h)` : ''}`}
                  />
                )}
                <DetailRow
                  icon={<Calendar className="w-4 h-4" />}
                  label="Tarih"
                  value={fmtDate(violation.created_at)}
                />
              </div>
            </div>

            {/* Harita linki */}
            {mapUrl && (
              <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-slate-700/50
                  hover:bg-slate-700 border border-slate-600 rounded-xl text-slate-300
                  hover:text-white text-sm font-medium transition">
                <MapPin className="w-4 h-4" />
                Haritada Görüntüle
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
