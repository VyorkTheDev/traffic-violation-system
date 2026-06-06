import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, LogOut, Car, Plus, Trash2, ChevronRight, Search,
  MapPin, Gauge, Calendar, Phone, Cigarette, AlertTriangle,
  CheckCircle2, XCircle, X, Loader2, RefreshCw,
  Upload, Camera, Edit2, FileText, LayoutList, Eye,
} from 'lucide-react'
import { vehicles as vehiclesApi, violations as violationsApi, police as policeApi, auth as authApi } from '../services/api'
import { getUser, logout } from '../utils/auth'
import { fmtDate } from '../utils/format'
import { formatPlate, normalizePlate, normalizePlateInput, validatePlate } from '../utils/plate'
import Modal from '../components/Modal'
import AiBadge from '../components/AiBadge'
import ViolationPills from '../components/ViolationPills'
import PlateInput from '../components/PlateInput'

function InfoBox({ icon, label, value }) {
  return (
    <div className="bg-slate-700/30 border border-slate-700 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">{icon}{label}</div>
      <p className="text-sm text-white font-medium truncate">{value || '—'}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Violation Detail Modal
// ---------------------------------------------------------------------------
function ViolationDetailModal({ violation, open, onClose }) {
  if (!violation) return null
  const vt = violation.violation_type || {}
  function Row({ icon, label, detected }) {
    return (
      <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${detected ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">{icon}{label}</div>
        {detected
          ? <span className="flex items-center gap-1 text-xs font-semibold text-red-400"><XCircle className="w-4 h-4" />Tespit</span>
          : <span className="flex items-center gap-1 text-xs font-semibold text-green-400"><CheckCircle2 className="w-4 h-4" />Temiz</span>}
      </div>
    )
  }
  return (
    <Modal open={open} onClose={onClose} title={`İhlal #${violation.id}`}>
      <div className="space-y-4">
        {violation.photo_url && (
          <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
            <img src={violation.photo_url} alt="İhlal" className="w-full object-cover max-h-60" onError={e => { e.target.style.display = 'none' }} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <InfoBox icon={<Calendar className="w-4 h-4 text-slate-400" />} label="Tarih" value={fmtDate(violation.created_at)} />
          <InfoBox icon={<MapPin className="w-4 h-4 text-slate-400" />} label="Konum" value={violation.location} />
          <InfoBox icon={<Car className="w-4 h-4 text-slate-400" />} label="Plaka" value={formatPlate(violation.plate)} />
          {violation.speed != null && <InfoBox icon={<Gauge className="w-4 h-4 text-slate-400" />} label="Hız" value={`${violation.speed} km/h`} />}
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Sonuçları</p>
            <AiBadge status={violation.ai_status} />
          </div>
          {violation.ai_status === 'completed' ? (
            <div className="space-y-2">
              <Row icon={<Phone className="w-4 h-4" />} label="Telefon Kullanımı" detected={vt.phone} />
              <Row icon={<Cigarette className="w-4 h-4" />} label="Sigara İçme" detected={vt.smoking} />
              <Row icon={<AlertTriangle className="w-4 h-4" />} label="Kemer Takmama" detected={vt.no_seatbelt} />
            </div>
          ) : violation.ai_status === 'failed' ? (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">
                {violation.ai_result?.reason === 'invalid_scene'
                  ? 'Fotoğraf geçersiz — araç sürücüsü tespit edilemedi.'
                  : 'AI analizi başarısız.'}
              </p>
            </div>
          ) : <p className="text-sm text-slate-500 italic">AI analizi devam ediyor...</p>}
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Tab: My Vehicles (citizen-like)
// ---------------------------------------------------------------------------
function TabVehicles() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [delConfirm, setDelConfirm] = useState(null)
  const [delLoading, setDelLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [violations, setViolations] = useState([])
  const [loadingV, setLoadingV] = useState(false)
  const [detailV, setDetailV] = useState(null)

  useEffect(() => {
    vehiclesApi.getMyVehicles().then(r => setList(r.data.data || [])).finally(() => setLoading(false))
  }, [])

  const loadViolations = useCallback((vehicle) => {
    if (!vehicle) return
    setLoadingV(true)
    violationsApi.getMyViolations()
      .then(r => setViolations((r.data.data || []).filter(v => v.plate === vehicle.plate)))
      .finally(() => setLoadingV(false))
  }, [])

  function select(v) {
    const next = selected?.id === v.id ? null : v
    setSelected(next)
    if (next) loadViolations(next)
    else setViolations([])
  }

  async function doDelete(id) {
    setDelLoading(true)
    try {
      await vehiclesApi.deleteVehicle(id)
      setList(p => p.filter(v => v.id !== id))
      if (selected?.id === id) { setSelected(null); setViolations([]) }
    } finally { setDelLoading(false); setDelConfirm(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Araçlarım</h2>
          <p className="text-sm text-slate-400 mt-0.5">Kişisel araçlarınız ve ihlal geçmişi</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          <Plus className="w-4 h-4" />Araç Ekle
        </button>
      </div>

      {loading ? <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" />Yükleniyor...</div>
        : list.length === 0 ? (
          <div className="border-2 border-dashed border-slate-800 rounded-2xl py-14 text-center">
            <Car className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">Henüz araç yok</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map(v => (
              <div key={v.id} onClick={() => select(v)}
                className={`relative group bg-slate-900 border rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg ${selected?.id === v.id ? 'border-blue-500 ring-1 ring-blue-500/30 shadow-lg shadow-blue-500/10' : 'border-slate-800 hover:border-slate-700'}`}>
                <button onClick={e => { e.stopPropagation(); setDelConfirm(v.id) }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-600/10 border border-blue-600/20 rounded-xl flex items-center justify-center">
                    <Car className="w-5 h-5 text-blue-400" />
                  </div>
                  <div><p className="font-bold text-white tracking-widest text-sm">{formatPlate(v.plate)}</p><p className="text-xs text-slate-400">{v.year}</p></div>
                </div>
                <p className="text-slate-300 text-sm font-medium">{v.brand} {v.model}</p>
                {selected?.id === v.id && <p className="text-xs text-blue-400 mt-2 flex items-center gap-1"><ChevronRight className="w-3 h-3" />İhlaller görüntüleniyor</p>}
              </div>
            ))}
          </div>
        )}

      {/* Violations for selected vehicle */}
      {selected && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">{formatPlate(selected.plate)} — İhlaller</h3>
            <button onClick={() => loadViolations(selected)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition">
              <RefreshCw className="w-3.5 h-3.5" />Yenile
            </button>
          </div>
          {loadingV ? <div className="flex items-center justify-center py-10 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /></div>
            : violations.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl py-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Bu araç için ihlal kaydı yok</p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">Tarih</th>
                    <th className="text-left px-4 py-3 font-medium">Konum</th>
                    <th className="text-left px-4 py-3 font-medium">İhlal</th>
                    <th className="text-left px-4 py-3 font-medium">AI</th>
                    <th className="px-4 py-3" />
                  </tr></thead>
                  <tbody className="divide-y divide-slate-800">
                    {violations.map(v => (
                      <tr key={v.id} onClick={() => setDetailV(v)} className="hover:bg-slate-800/50 cursor-pointer transition-colors">
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap text-xs">{fmtDate(v.created_at)}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[130px]">{v.location}</td>
                        <td className="px-4 py-3"><ViolationPills vt={v.violation_type} speed={v.speed} speedLimit={v.speed_limit} /></td>
                        <td className="px-4 py-3"><AiBadge status={v.ai_status} /></td>
                        <td className="px-4 py-3 text-right"><ChevronRight className="w-4 h-4 text-slate-600 inline" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* Add vehicle modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Yeni Araç Ekle">
        <AddVehicleForm
          onAdded={v => { setList(p => [v, ...p]); setShowAdd(false) }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      {/* Delete confirm */}
      {delConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDelConfirm(null)} />
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-center mx-auto mb-4"><Trash2 className="w-6 h-6 text-red-400" /></div>
            <h3 className="text-white font-semibold mb-2">Aracı Sil</h3>
            <p className="text-slate-400 text-sm mb-5">Bu işlem geri alınamaz.</p>
            <div className="flex gap-3">
              <button onClick={() => setDelConfirm(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2.5 rounded-lg transition text-sm">İptal</button>
              <button onClick={() => doDelete(delConfirm)} disabled={delLoading} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2">
                {delLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Sil
              </button>
            </div>
          </div>
        </div>
      )}

      <ViolationDetailModal violation={detailV} open={!!detailV} onClose={() => setDetailV(null)} />
    </div>
  )
}

function AddVehicleForm({ onAdded, onCancel }) {
  const [form, setForm] = useState({ plate: '', brand: '', model: '', year: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputCls = "w-full bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"

  async function submit(e) {
    e.preventDefault()
    const plateNorm = normalizePlate(form.plate)
    const plateErr  = validatePlate(plateNorm)
    if (plateErr) { setError(plateErr); return }
    if (!form.brand.trim() || !form.model.trim() || !form.year) { setError('Tüm alanlar zorunludur.'); return }
    const year = parseInt(form.year)
    if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1) { setError('Geçerli bir yıl girin.'); return }
    setLoading(true)
    try {
      const res = await vehiclesApi.addVehicle(plateNorm, form.brand, form.model, year)
      onAdded(res.data.data)
    } catch (err) { setError(err.response?.data?.message || 'Araç eklenemedi.')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-red-300 text-sm"><XCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
      <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Plaka</label><PlateInput value={form.plate} onChange={v => { setForm({...form, plate: v}); setError('') }} className={inputCls} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Marka</label><input name="brand" value={form.brand} onChange={e => { setForm({...form, brand: e.target.value}); setError('') }} placeholder="Toyota" className={inputCls} /></div>
        <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Model</label><input name="model" value={form.model} onChange={e => { setForm({...form, model: e.target.value}); setError('') }} placeholder="Corolla" className={inputCls} /></div>
      </div>
      <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Yıl</label><input name="year" type="number" value={form.year} onChange={e => { setForm({...form, year: e.target.value}); setError('') }} placeholder="2020" className={inputCls} /></div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2.5 rounded-lg transition text-sm">İptal</button>
        <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Ekleniyor...</> : 'Araç Ekle'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Location Autocomplete (Nominatim)
// ---------------------------------------------------------------------------
const SPEED_LIMITS = {
  // Yol tipleri
  motorway:      120,
  trunk:          90,
  primary:        50,
  secondary:      50,
  tertiary:       50,
  residential:    30,
  living_street:  30,
  service:        30,
  unclassified:   50,
  // Yerleşim alanı tipleri (Nominatim place sınıfı)
  suburb:         30,   // mahalle
  neighbourhood:  30,
  quarter:        30,
  village:        50,
  hamlet:         30,
  town:           50,
}

function LocationAutocomplete({ value, onSelect, inputCls }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  function handleInput(e) {
    const q = e.target.value
    setQuery(q)
    onSelect(q, null, null, null)
    clearTimeout(debounceRef.current)
    if (q.length < 3) {
      setSuggestions([])
      setLoading(false)
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setOpen(true)
      setSuggestions([])
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=tr&addressdetails=1`
        )
        const data = await res.json()
        setSuggestions(data)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 500)
  }

  function handleSelect(item) {
    const text = item.display_name
    setQuery(text)
    setSuggestions([])
    setOpen(false)
    const speedLimit = SPEED_LIMITS[item.type] ?? null
    onSelect(text, parseFloat(item.lat), parseFloat(item.lon), speedLimit)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={query}
        onChange={handleInput}
        placeholder="İstanbul, Kadıköy — E5 üzerinde"
        className={inputCls}
        autoComplete="off"
      />
      {(open || loading) && query.length >= 3 && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          {loading && (
            <div className="px-3 py-2.5 text-sm text-slate-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Aranıyor...
            </div>
          )}
          {!loading && suggestions.length === 0 && (
            <div className="px-3 py-2.5 text-sm text-slate-400">Sonuç bulunamadı</div>
          )}
          {!loading && suggestions.map((item, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => handleSelect(item)}
              className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition flex items-start gap-2 border-b border-slate-700/50 last:border-0"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{item.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Report Violation
// ---------------------------------------------------------------------------
function TabReport() {
  const [form, setForm] = useState({ plate: '', speed: '', location: '', latitude: null, longitude: null, speed_limit: null })
  const [speedSource, setSpeedSource] = useState(null)  // null | 'auto' | 'manual'
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)  // created violation
  const fileRef = useRef()

  function handleFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Sadece resim dosyaları yüklenebilir.'); return }
    if (file.size > 16 * 1024 * 1024) { setError('Dosya boyutu 16 MB\'ı geçemez.'); return }
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
    setError('')
  }

  function onDrop(e) {
    e.preventDefault(); setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!photo) { setError('Fotoğraf zorunludur.'); return }
    const plateNorm = normalizePlate(form.plate)
    const plateErr  = validatePlate(plateNorm)
    if (plateErr) { setError(plateErr); return }
    if (!form.location.trim()) { setError('Konum zorunludur.'); return }

    setLoading(true); setError(''); setResult(null)
    const fd = new FormData()
    fd.append('photo', photo)
    fd.append('plate', plateNorm)
    fd.append('location', form.location.trim())
    if (form.speed) fd.append('speed', form.speed)
    if (form.speed_limit != null) fd.append('speed_limit', form.speed_limit)
    if (form.latitude != null) fd.append('latitude', form.latitude)
    if (form.longitude != null) fd.append('longitude', form.longitude)

    try {
      const res = await violationsApi.createViolation(fd)
      if (res.status === 201) {
        setResult(res.data.data)
        setForm({ plate: '', speed: '', location: '', latitude: null, longitude: null, speed_limit: null })
        setSpeedSource(null)
        setPhoto(null); setPreview(null)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'İhlal kaydedilemedi.')
    } finally { setLoading(false) }
  }

  const inputCls = "w-full bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">İhlal Bildir</h2>
        <p className="text-sm text-slate-400 mt-0.5">Fotoğraf yükleyin, AI otomatik analiz eder</p>
      </div>

      {result ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <p className="text-green-300 font-semibold">İhlal kaydedildi! AI analizi başlatıldı.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-slate-400">İhlal ID:</span><span className="text-white font-mono">#{result.id}</span>
            <span className="text-slate-400">Plaka:</span><span className="text-white">{formatPlate(result.plate)}</span>
            <span className="text-slate-400">AI Durum:</span><AiBadge status={result.ai_status} />
          </div>
          <p className="text-xs text-slate-500 mt-3">AI analizi arka planda devam ediyor. "Raporlarım" sekmesinden durumu takip edin.</p>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="mt-4 flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 font-medium transition"
          >
            <Plus className="w-4 h-4" />Yeni İhlal Bildir
          </button>
        </div>
      ) : (
        <>
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-5 text-red-300 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Photo upload */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Fotoğraf *</label>
          {preview ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
              <img src={preview} alt="Önizleme" className="w-full max-h-64 object-cover" />
              <button type="button" onClick={() => { setPhoto(null); setPreview(null) }}
                className="absolute top-2 right-2 bg-slate-900/80 hover:bg-red-600/80 text-white p-1.5 rounded-lg transition">
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 bg-slate-900/80 text-xs text-slate-300 px-2 py-1 rounded-md">{photo?.name}</div>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl py-12 text-center cursor-pointer transition-colors ${dragging ? 'border-amber-500 bg-amber-500/5' : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'}`}
            >
              <Upload className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">Sürükle & Bırak veya <span className="text-amber-400">dosya seç</span></p>
              <p className="text-slate-600 text-xs mt-1">PNG, JPG, WEBP — max 16 MB</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            </div>
          )}
        </div>

        {/* Plate */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Plaka *</label>
          <PlateInput value={form.plate} onChange={v => { setForm({...form, plate: v}); setError('') }} className={inputCls} />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Konum *</label>
          <LocationAutocomplete
            value={form.location}
            onSelect={(text, lat, lng, speedLimit) => {
              const next = { ...form, location: text, latitude: lat, longitude: lng, speed_limit: speedLimit }
              if (speedLimit != null) {
                next.speed = String(speedLimit); setSpeedSource('auto')
              } else if (speedSource === 'auto') {
                // User edited location after auto-fill → clear auto speed
                next.speed = ''; setSpeedSource(null)
              }
              // speedSource === null or 'manual' → don't touch speed
              setForm(next); setError('')
            }}
            inputCls={inputCls}
          />
        </div>

        {/* Speed (optional) */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
            Hız <span className="text-slate-500 font-normal">(isteğe bağlı)</span>
            {speedSource === 'auto'   && <span className="text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full">(Otomatik)</span>}
            {speedSource === 'manual' && <span className="text-xs font-medium text-blue-400  bg-blue-400/10  border border-blue-400/30  px-2 py-0.5 rounded-full">(Manuel)</span>}
          </label>
          <div className="relative">
            <input type="number" value={form.speed}
              onChange={e => { setForm({...form, speed: e.target.value}); if (speedSource === 'auto') setSpeedSource('manual') }}
              placeholder="0" min="0" max="300"
              className={inputCls + " pr-16"} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">km/h</span>
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-amber-900 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Kaydediliyor...</> : <><Camera className="w-5 h-5" />İhlali Kaydet & AI Analiz Başlat</>}
        </button>
      </form>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: My Reports
// ---------------------------------------------------------------------------
function TabReports() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState(null)
  const [delConfirm, setDelConfirm] = useState(null)
  const [delLoading, setDelLoading] = useState(false)
  const [detailV, setDetailV] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    policeApi.getPoliceViolations()
      .then(r => setList(r.data.data || []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function doDelete(id) {
    setDelLoading(true)
    try {
      await violationsApi.deleteViolation(id)
      setList(p => p.filter(v => v.id !== id))
    } finally { setDelLoading(false); setDelConfirm(null) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-white">Raporlarım</h2>
          <p className="text-sm text-slate-400 mt-0.5">Tarafınızdan oluşturulan ihlal kayıtları</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition">
          <RefreshCw className="w-4 h-4" />Yenile
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" />Yükleniyor...</div>
      ) : list.length === 0 ? (
        <div className="border-2 border-dashed border-slate-800 rounded-2xl py-16 text-center">
          <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Henüz rapor yok</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">#</th>
                <th className="text-left px-5 py-3 font-medium">Tarih</th>
                <th className="text-left px-5 py-3 font-medium">Plaka</th>
                <th className="text-left px-5 py-3 font-medium">Konum</th>
                <th className="text-left px-5 py-3 font-medium">İhlal</th>
                <th className="text-left px-5 py-3 font-medium">AI</th>
                <th className="px-5 py-3 font-medium">İşlem</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-800">
                {list.map(v => (
                  <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">{v.id}</td>
                    <td className="px-5 py-3.5 text-slate-300 text-xs whitespace-nowrap">{fmtDate(v.created_at)}</td>
                    <td className="px-5 py-3.5"><span className="font-bold text-white tracking-wider text-xs">{formatPlate(v.plate)}</span></td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs max-w-[140px] truncate">{v.location}</td>
                    <td className="px-5 py-3.5"><ViolationPills vt={v.violation_type} speed={v.speed} speedLimit={v.speed_limit} /></td>
                    <td className="px-5 py-3.5"><AiBadge status={v.ai_status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setDetailV(v)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition" title="Detay">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditTarget(v)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition" title="Düzenle">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDelConfirm(v.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition" title="Sil">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {list.map(v => (
              <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white tracking-wider text-sm">{formatPlate(v.plate)}</span>
                  <AiBadge status={v.ai_status} />
                </div>
                <div className="text-xs text-slate-500 mb-1">{fmtDate(v.created_at)}</div>
                <div className="flex items-center gap-1 text-xs text-slate-400 mb-2"><MapPin className="w-3 h-3" />{v.location}</div>
                <ViolationPills vt={v.violation_type} speed={v.speed} speedLimit={v.speed_limit} />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setDetailV(v)} className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded-lg transition"><Eye className="w-3.5 h-3.5" />Detay</button>
                  <button onClick={() => setEditTarget(v)} className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 py-1.5 rounded-lg transition"><Edit2 className="w-3.5 h-3.5" />Düzenle</button>
                  <button onClick={() => setDelConfirm(v.id)} className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 py-1.5 rounded-lg transition"><Trash2 className="w-3.5 h-3.5" />Sil</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`İhlal #${editTarget?.id} Düzenle`}>
        {editTarget && (
          <EditViolationForm
            violation={editTarget}
            onUpdated={updated => { setList(p => p.map(v => v.id === updated.id ? updated : v)); setEditTarget(null) }}
            onCancel={() => setEditTarget(null)}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      {delConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDelConfirm(null)} />
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-center mx-auto mb-4"><Trash2 className="w-6 h-6 text-red-400" /></div>
            <h3 className="text-white font-semibold mb-2">İhlali Sil</h3>
            <p className="text-slate-400 text-sm mb-5">Bu kayıt ve fotoğrafı kalıcı olarak silinecek.</p>
            <div className="flex gap-3">
              <button onClick={() => setDelConfirm(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2.5 rounded-lg transition text-sm">İptal</button>
              <button onClick={() => doDelete(delConfirm)} disabled={delLoading} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2">
                {delLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Sil
              </button>
            </div>
          </div>
        </div>
      )}

      <ViolationDetailModal violation={detailV} open={!!detailV} onClose={() => setDetailV(null)} />
    </div>
  )
}

function EditViolationForm({ violation, onUpdated, onCancel }) {
  const [form, setForm] = useState({ speed: violation.speed ?? '', location: violation.location ?? '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputCls = "w-full bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"

  async function submit(e) {
    e.preventDefault()
    if (!form.location.trim()) { setError('Konum boş olamaz.'); return }
    setLoading(true)
    try {
      const payload = { location: form.location.trim() }
      if (form.speed !== '' && form.speed !== null) payload.speed = parseInt(form.speed)
      const res = await violationsApi.updateViolation(violation.id, payload)
      onUpdated(res.data.data)
    } catch (err) { setError(err.response?.data?.message || 'Güncellenemedi.')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-red-300 text-sm"><XCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
      <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Konum</label>
        <input value={form.location} onChange={e => { setForm({...form, location: e.target.value}); setError('') }} className={inputCls} /></div>
      <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Hız (km/h)</label>
        <input type="number" value={form.speed} onChange={e => setForm({...form, speed: e.target.value})} placeholder="Boş bırakılabilir" className={inputCls} /></div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2.5 rounded-lg transition text-sm">İptal</button>
        <button type="submit" disabled={loading} className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-900 text-white font-medium py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Kaydediliyor...</> : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Tab: Plate Search
// ---------------------------------------------------------------------------
function TabSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detailV, setDetailV] = useState(null)

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true); setError(''); setResults(null)
    try {
      const res = await policeApi.searchByPlate(normalizePlate(query))
      setResults(res.data.data || [])
    } catch (err) {
      if (err.response?.status === 404) setError(`"${query.toUpperCase()}" ile eşleşen araç bulunamadı.`)
      else setError(err.response?.data?.message || 'Arama başarısız.')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Plaka Sorgula</h2>
        <p className="text-sm text-slate-400 mt-0.5">Kısmi eşleşme desteklenmektedir</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={query}
            onChange={e => { setQuery(normalizePlateInput(e.target.value)); setError('') }}
            placeholder="Plaka ara… (örn: 34, 34AB)"
            className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
          />
        </div>
        <button type="submit" disabled={loading || !query.trim()}
          className="bg-amber-600 hover:bg-amber-500 disabled:bg-amber-900 disabled:cursor-not-allowed text-white font-medium px-5 py-3 rounded-xl transition flex items-center gap-2 text-sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Ara
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-amber-300 text-sm mb-4">
          <Search className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-6">
          {results.map(vehicle => (
            <div key={vehicle.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              {/* Vehicle header */}
              <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-800 bg-slate-800/40">
                <div className="w-10 h-10 bg-amber-600/10 border border-amber-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Car className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-white tracking-widest text-lg">{formatPlate(vehicle.plate)}</span>
                    <span className="text-sm text-slate-400">{vehicle.brand} {vehicle.model} ({vehicle.year})</span>
                  </div>
                </div>
                <span className={`text-xs font-medium px-3 py-1 rounded-full border ${vehicle.violations?.length > 0 ? 'bg-red-500/10 text-red-300 border-red-500/30' : 'bg-green-500/10 text-green-300 border-green-500/30'}`}>
                  {vehicle.violations?.length || 0} ihlal
                </span>
                {vehicle.owner && (
                  <div className="flex items-center gap-2 ml-2">
                    <span className={`text-xs font-medium px-3 py-1 rounded-full border ${
                      vehicle.owner.license_status === 'suspended'
                        ? 'bg-red-500/10 text-red-300 border-red-500/30'
                        : 'bg-green-500/10 text-green-300 border-green-500/30'
                    }`}>
                      {vehicle.owner.license_status === 'suspended' ? 'Ehliyet: Askıda' : 'Ehliyet: Geçerli'}
                    </span>
                    <span className="text-xs font-medium px-3 py-1 rounded-full border bg-blue-500/10 text-blue-300 border-blue-500/30">
                      {vehicle.owner.points ?? 100} puan
                    </span>
                  </div>
                )}
              </div>

              {/* Violations list */}
              {!vehicle.violations || vehicle.violations.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">Bu araç için ihlal kaydı yok</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                      <th className="text-left px-5 py-3 font-medium">Tarih</th>
                      <th className="text-left px-5 py-3 font-medium">Konum</th>
                      <th className="text-left px-5 py-3 font-medium">İhlal</th>
                      <th className="text-left px-5 py-3 font-medium">AI</th>
                      <th className="px-5 py-3" />
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800">
                      {vehicle.violations.map(v => (
                        <tr key={v.id} onClick={() => setDetailV(v)} className="hover:bg-slate-800/50 cursor-pointer transition-colors">
                          <td className="px-5 py-3.5 text-slate-300 text-xs whitespace-nowrap">{fmtDate(v.created_at)}</td>
                          <td className="px-5 py-3.5 text-slate-400 text-xs max-w-[150px] truncate">{v.location}</td>
                          <td className="px-5 py-3.5"><ViolationPills vt={v.violation_type} speed={v.speed} speedLimit={v.speed_limit} /></td>
                          <td className="px-5 py-3.5"><AiBadge status={v.ai_status} /></td>
                          <td className="px-5 py-3.5 text-right"><ChevronRight className="w-4 h-4 text-slate-600 inline" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ViolationDetailModal violation={detailV} open={!!detailV} onClose={() => setDetailV(null)} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main PoliceDashboard
// ---------------------------------------------------------------------------
const TABS = [
  { id: 'vehicles', label: 'Araçlarım',      icon: Car },
  { id: 'report',   label: 'İhlal Bildir',   icon: Camera },
  { id: 'reports',  label: 'Raporlarım',     icon: LayoutList },
  { id: 'search',   label: 'Plaka Sorgula',  icon: Search },
]

export default function PoliceDashboard() {
  const navigate = useNavigate()
  const user = getUser()
  const [me, setMe] = useState(user)
  const [activeTab, setActiveTab] = useState('report')

  useEffect(() => {
    authApi.me().then(r => setMe(r.data.data)).catch(() => {})
  }, [])

  function handleLogout() { logout(navigate) }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white hidden sm:block">Trafik İhlal Sistemi</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300 hidden sm:block">{user?.username}</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-500/20 text-amber-300 border-amber-500/30">Polis</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-blue-500/20 text-blue-300 border-blue-500/30 hidden sm:inline-flex">
              {me?.points ?? 100} Puan
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border hidden sm:inline-flex ${
              me?.license_status === 'suspended'
                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                : 'bg-green-500/20 text-green-300 border-green-500/30'
            }`}>
              {me?.license_status === 'suspended' ? 'Ehliyet: Askıda' : 'Ehliyet: Geçerli'}
            </span>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition">
              <LogOut className="w-4 h-4" /><span className="hidden sm:block">Çıkış</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-8 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  active
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:block">{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'vehicles' && <TabVehicles />}
        {activeTab === 'report'   && <TabReport />}
        {activeTab === 'reports'  && <TabReports />}
        {activeTab === 'search'   && <TabSearch />}
      </div>
    </div>
  )
}
