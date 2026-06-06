import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, LogOut, Car, Plus, Trash2, ChevronRight,
  MapPin, Gauge, Calendar, Phone, Cigarette, AlertTriangle,
  CheckCircle2, XCircle, Loader2, RefreshCw,
} from 'lucide-react'
import { vehicles as vehiclesApi, violations as violationsApi, auth as authApi } from '../services/api'
import { getUser, logout } from '../utils/auth'
import { fmtDate } from '../utils/format'
import { normalizePlate, validatePlate } from '../utils/plate'
import Modal from '../components/Modal'
import AiBadge from '../components/AiBadge'
import ViolationPills from '../components/ViolationPills'
import PlateInput from '../components/PlateInput'

// ---------------------------------------------------------------------------
// Add Vehicle Modal
// ---------------------------------------------------------------------------
function AddVehicleModal({ open, onClose, onAdded }) {
  const [form, setForm] = useState({ plate: '', brand: '', model: '', year: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const plateNorm = normalizePlate(form.plate)
    const plateErr  = validatePlate(plateNorm)
    if (plateErr) { setError(plateErr); return }
    if (!form.brand.trim() || !form.model.trim() || !form.year) {
      setError('Tüm alanlar zorunludur.')
      return
    }
    const year = parseInt(form.year)
    if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1) {
      setError('Geçerli bir yıl girin.')
      return
    }
    setLoading(true)
    try {
      const res = await vehiclesApi.addVehicle(plateNorm, form.brand.trim(), form.model.trim(), year)
      onAdded(res.data.data)
      setForm({ plate: '', brand: '', model: '', year: '' })
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Araç eklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"

  return (
    <Modal open={open} onClose={onClose} title="Yeni Araç Ekle">
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 mb-4 text-red-300 text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1.5 font-medium">Plaka</label>
          <PlateInput value={form.plate} onChange={v => { setForm({ ...form, plate: v }); setError('') }} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5 font-medium">Marka</label>
            <input name="brand" value={form.brand} onChange={handleChange} placeholder="Toyota" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5 font-medium">Model</label>
            <input name="model" value={form.model} onChange={handleChange} placeholder="Corolla" className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1.5 font-medium">Yıl</label>
          <input name="year" type="number" value={form.year} onChange={handleChange} placeholder="2020" className={inputCls} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2.5 rounded-lg transition text-sm">
            İptal
          </button>
          <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Ekleniyor...</> : 'Araç Ekle'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Violation Detail Modal
// ---------------------------------------------------------------------------
function ViolationDetailModal({ violation, open, onClose }) {
  if (!violation) return null
  const vt = violation.violation_type || {}

  function DetectRow({ icon, label, detected }) {
    return (
      <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${detected ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          {icon}{label}
        </div>
        {detected
          ? <span className="flex items-center gap-1 text-xs font-semibold text-red-400"><XCircle className="w-4 h-4" />Tespit Edildi</span>
          : <span className="flex items-center gap-1 text-xs font-semibold text-green-400"><CheckCircle2 className="w-4 h-4" />Temiz</span>}
      </div>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={`İhlal #${violation.id} Detayı`}>
      <div className="space-y-5">
        {/* Photo */}
        {violation.photo_url && (
          <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
            <img
              src={violation.photo_url}
              alt="İhlal fotoğrafı"
              className="w-full object-cover max-h-64"
              onError={e => { e.target.style.display = 'none' }}
            />
          </div>
        )}

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3">
          <InfoBox icon={<Calendar className="w-4 h-4 text-slate-400" />} label="Tarih" value={fmtDate(violation.created_at)} />
          <InfoBox icon={<MapPin className="w-4 h-4 text-slate-400" />} label="Konum" value={violation.location} />
          {violation.speed != null && (
            <InfoBox icon={<Gauge className="w-4 h-4 text-slate-400" />} label="Hız" value={`${violation.speed} km/h`} />
          )}
          <InfoBox icon={<Car className="w-4 h-4 text-slate-400" />} label="Plaka" value={violation.plate} />
        </div>

        {/* AI Analysis */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">AI Analiz Sonuçları</h4>
            <AiBadge status={violation.ai_status} />
          </div>
          {violation.ai_status === 'completed' ? (
            <div className="space-y-2">
              <DetectRow icon={<Phone className="w-4 h-4" />}       label="Telefon Kullanımı"  detected={vt.phone} />
              <DetectRow icon={<Cigarette className="w-4 h-4" />}   label="Sigara İçme"        detected={vt.smoking} />
              <DetectRow icon={<AlertTriangle className="w-4 h-4" />} label="Kemer Takmama"    detected={vt.no_seatbelt} />
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">AI analizi henüz tamamlanmadı.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}

function InfoBox({ icon, label, value }) {
  return (
    <div className="bg-slate-700/30 border border-slate-700 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">{icon}{label}</div>
      <p className="text-sm text-white font-medium truncate">{value || '—'}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function CitizenDashboard() {
  const navigate = useNavigate()
  const user = getUser()
  const [me, setMe] = useState(user)

  useEffect(() => {
    authApi.me().then(r => setMe(r.data.data)).catch(() => {})
  }, [])

  const [vehicleList, setVehicleList] = useState([])
  const [loadingVehicles, setLoadingVehicles] = useState(true)

  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [violationList, setViolationList] = useState([])
  const [loadingViolations, setLoadingViolations] = useState(false)

  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)   // vehicle id to delete
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [selectedViolation, setSelectedViolation] = useState(null)

  // Load vehicles
  useEffect(() => {
    vehiclesApi.getMyVehicles()
      .then(res => setVehicleList(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingVehicles(false))
  }, [])

  // Load violations for selected vehicle
  const loadViolations = useCallback(() => {
    if (!selectedVehicle) return
    setLoadingViolations(true)
    violationsApi.getMyViolations()
      .then(res => {
        const all = res.data.data || []
        setViolationList(all.filter(v => v.plate === selectedVehicle.plate))
      })
      .catch(() => {})
      .finally(() => setLoadingViolations(false))
  }, [selectedVehicle])

  useEffect(() => { loadViolations() }, [loadViolations])

  function handleLogout() { logout(navigate) }

  function handleVehicleAdded(vehicle) {
    setVehicleList(prev => [vehicle, ...prev])
  }

  async function handleDeleteVehicle(vehicleId) {
    setDeleteLoading(true)
    try {
      await vehiclesApi.deleteVehicle(vehicleId)
      setVehicleList(prev => prev.filter(v => v.id !== vehicleId))
      if (selectedVehicle?.id === vehicleId) {
        setSelectedVehicle(null)
        setViolationList([])
      }
    } catch {
    } finally {
      setDeleteLoading(false)
      setDeleteConfirm(null)
    }
  }

  const roleBadge = {
    citizen: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    police:  'bg-amber-500/20 text-amber-300 border-amber-500/30',
    admin:   'bg-purple-500/20 text-purple-300 border-purple-500/30',
  }[user?.role] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'

  const roleLabel = { citizen: 'Vatandaş', police: 'Polis', admin: 'Admin' }[user?.role] || user?.role

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white hidden sm:block">Trafik İhlal Sistemi</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300 hidden sm:block">{user?.username}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${roleBadge}`}>{roleLabel}</span>
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
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Çıkış</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* MY VEHICLES */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Araçlarım</h2>
              <p className="text-sm text-slate-400 mt-0.5">Kayıtlı araçlarınız ve ihlal geçmişi</p>
            </div>
            <button
              onClick={() => setShowAddVehicle(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Araç Ekle</span>
            </button>
          </div>

          {loadingVehicles ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Yükleniyor...
            </div>
          ) : vehicleList.length === 0 ? (
            <div className="border-2 border-dashed border-slate-800 rounded-2xl py-16 text-center">
              <Car className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">Henüz araç eklenmemiş</p>
              <p className="text-slate-600 text-sm mt-1">Araç eklemek için butona tıklayın</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicleList.map(v => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVehicle(selectedVehicle?.id === v.id ? null : v)}
                  className={`relative group bg-slate-900 border rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    selectedVehicle?.id === v.id
                      ? 'border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Delete button */}
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(v.id) }}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-600/10 border border-blue-600/20 rounded-xl flex items-center justify-center">
                      <Car className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-bold text-white tracking-widest text-sm">{v.plate}</p>
                      <p className="text-xs text-slate-400">{v.year}</p>
                    </div>
                  </div>
                  <p className="text-slate-300 text-sm font-medium">{v.brand} {v.model}</p>

                  {selectedVehicle?.id === v.id && (
                    <div className="flex items-center gap-1 text-blue-400 text-xs mt-2 font-medium">
                      <ChevronRight className="w-3 h-3" /> İhlaller görüntüleniyor
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* VIOLATIONS */}
        {selectedVehicle && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {selectedVehicle.plate} — İhlaller
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  {selectedVehicle.brand} {selectedVehicle.model} ({selectedVehicle.year})
                </p>
              </div>
              <button
                onClick={loadViolations}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition"
              >
                <RefreshCw className="w-4 h-4" /> Yenile
              </button>
            </div>

            {loadingViolations ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yükleniyor...
              </div>
            ) : violationList.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl py-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
                <p className="text-slate-300 font-medium">Bu araç için kayıtlı ihlal yok</p>
                <p className="text-slate-600 text-sm mt-1">Temiz bir sicil!</p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                        <th className="text-left px-5 py-3 font-medium">#</th>
                        <th className="text-left px-5 py-3 font-medium">Tarih</th>
                        <th className="text-left px-5 py-3 font-medium">Konum</th>
                        <th className="text-left px-5 py-3 font-medium">İhlal Türü</th>
                        <th className="text-left px-5 py-3 font-medium">AI Durum</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {violationList.map(v => (
                        <tr
                          key={v.id}
                          onClick={() => setSelectedViolation(v)}
                          className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-4 text-slate-400 font-mono text-xs">{v.id}</td>
                          <td className="px-5 py-4 text-slate-300 whitespace-nowrap">{fmtDate(v.created_at)}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5 text-slate-300 max-w-[180px]">
                              <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span className="truncate">{v.location}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <ViolationPills vt={v.violation_type} speed={v.speed} />
                          </td>
                          <td className="px-5 py-4"><AiBadge status={v.ai_status} /></td>
                          <td className="px-5 py-4 text-right">
                            <ChevronRight className="w-4 h-4 text-slate-600 inline-block" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-slate-800">
                  {violationList.map(v => (
                    <div
                      key={v.id}
                      onClick={() => setSelectedViolation(v)}
                      className="px-4 py-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500 font-mono">#{v.id}</span>
                        <AiBadge status={v.ai_status} />
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-slate-300 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {fmtDate(v.created_at)}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-600" />
                        {v.location}
                      </div>
                      <ViolationPills vt={v.violation_type} speed={v.speed} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Modals */}
      <AddVehicleModal
        open={showAddVehicle}
        onClose={() => setShowAddVehicle(false)}
        onAdded={handleVehicleAdded}
      />

      <ViolationDetailModal
        violation={selectedViolation}
        open={!!selectedViolation}
        onClose={() => setSelectedViolation(null)}
      />

      {/* Delete Confirm Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">Aracı Sil</h3>
            <p className="text-slate-400 text-sm mb-6">Bu aracı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2.5 rounded-lg transition text-sm"
              >
                İptal
              </button>
              <button
                onClick={() => handleDeleteVehicle(deleteConfirm)}
                disabled={deleteLoading}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white font-medium py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2"
              >
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
