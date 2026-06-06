import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Car, FileWarning, LogOut, ShieldCheck,
  Menu, X, Plus, Trash2, Edit2, ChevronUp, ChevronDown,
  Eye, CheckCircle2, XCircle, Loader2, RefreshCw,
  TrendingUp, MapPin, Calendar, ChevronRight,
  Gauge, Phone, Cigarette, AlertTriangle,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'
import { admin as adminApi } from '../services/api'
import { getUser, logout } from '../utils/auth'
import { fmtDate, fmtDateShort } from '../utils/format'
import { normalizePlate, validatePlate } from '../utils/plate'
import Modal from '../components/Modal'
import AiBadge from '../components/AiBadge'
import ViolationPills from '../components/ViolationPills'
import PlateInput from '../components/PlateInput'

// ---------------------------------------------------------------------------
// Admin-specific helpers
// ---------------------------------------------------------------------------
const ROLE_CFG = {
  citizen: { label: 'Vatandaş', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  police:  { label: 'Polis',    cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  admin:   { label: 'Admin',    cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
}

function RoleBadge({ role }) {
  const c = ROLE_CFG[role] || ROLE_CFG.citizen
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${c.cls}`}>{c.label}</span>
}

// ---------------------------------------------------------------------------
// Shared: SortIcon, Th, inputCls
// ---------------------------------------------------------------------------
const inputCls = "w-full bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
const selectCls = inputCls + " cursor-pointer"

function SortIcon({ col, sortKey, dir }) {
  if (sortKey !== col) return <ChevronUp className="w-3 h-3 opacity-20" />
  return dir === 'asc' ? <ChevronUp className="w-3 h-3 text-purple-400" /> : <ChevronDown className="w-3 h-3 text-purple-400" />
}

function useSortedData(data, defaultKey='id') {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState('desc')
  function toggleSort(key) {
    if (key === sortKey) setSortDir(d => d==='asc'?'desc':'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const sorted = useMemo(()=>[...data].sort((a,b)=>{
    const av = a[sortKey] ?? '', bv = b[sortKey] ?? ''
    const cmp = typeof av==='number' ? av-bv : String(av).localeCompare(String(bv),'tr')
    return sortDir==='asc' ? cmp : -cmp
  }),[data, sortKey, sortDir])
  return { sorted, sortKey, sortDir, toggleSort }
}

function Th({ children, col, sortKey, sortDir, onSort, className='' }) {
  return (
    <th className={`text-left px-4 py-3 font-medium text-xs text-slate-500 uppercase tracking-wider select-none cursor-pointer hover:text-slate-300 transition ${className}`}
      onClick={()=>onSort(col)}>
      <div className="flex items-center gap-1">{children}<SortIcon col={col} sortKey={sortKey} dir={sortDir} /></div>
    </th>
  )
}

function ConfirmDelete({ open, title, desc, onConfirm, onCancel, loading }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm text-center">
        <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-center mx-auto mb-4"><Trash2 className="w-6 h-6 text-red-400" /></div>
        <h3 className="text-white font-semibold mb-2">{title}</h3>
        <p className="text-slate-400 text-sm mb-5">{desc}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2.5 rounded-lg transition text-sm">İptal</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white font-medium py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Sil
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. DASHBOARD TAB
// ---------------------------------------------------------------------------
function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-400 text-sm font-medium">{label}</p>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold text-white">{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

const PIE_COLORS = ['#ef4444','#f97316','#eab308','#a855f7']

function TabDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    adminApi.getStats().then(r=>setStats(r.data.data)).finally(()=>setLoading(false))
  },[])

  if (loading) return <div className="flex items-center justify-center py-24 text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" />Yükleniyor...</div>
  if (!stats) return null

  const { users, vehicles, violations } = stats
  const td = violations.type_distribution
  const pieData = [
    { name:'Telefon',  value:td.phone },
    { name:'Sigara',   value:td.smoking },
    { name:'Kemer',    value:td.no_seatbelt },
    { name:'Hız',      value:td.speed },
  ].filter(d=>d.value>0)

  const lineData = violations.per_day_last_7.map(d=>({
    date: d.date.slice(5),
    count: d.count,
  }))

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Dashboard</h2>
        <p className="text-sm text-slate-400">Sistem geneli istatistikler</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-5 h-5 text-blue-400" />}          label="Toplam Kullanıcı"   value={users.total}      sub={`${users.citizen} vatandaş`} color="bg-blue-500/10 border border-blue-500/20" />
        <StatCard icon={<ShieldCheck className="w-5 h-5 text-amber-400" />}   label="Polis Sayısı"      value={users.police}     sub={`${users.admin} admin`}       color="bg-amber-500/10 border border-amber-500/20" />
        <StatCard icon={<Car className="w-5 h-5 text-green-400" />}           label="Toplam Araç"       value={vehicles.total}   sub="kayıtlı araçlar"              color="bg-green-500/10 border border-green-500/20" />
        <StatCard icon={<FileWarning className="w-5 h-5 text-red-400" />}     label="Toplam İhlal"      value={violations.total} sub="tüm zamanlar"                 color="bg-red-500/10 border border-red-500/20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line chart */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <h3 className="text-white font-semibold text-sm">Son 7 Gün — İhlal Trendi</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData} margin={{ top:4, right:8, bottom:0, left:-20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#f1f5f9' }} />
              <Line type="monotone" dataKey="count" stroke="#a855f7" strokeWidth={2.5} dot={{ fill:'#a855f7', r:4 }} activeDot={{ r:6 }} name="İhlal" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar/Pie chart */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <FileWarning className="w-4 h-4 text-red-400" />
            <h3 className="text-white font-semibold text-sm">İhlal Türü Dağılımı</h3>
          </div>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-slate-500 text-sm">Henüz ihlal verisi yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pieData} margin={{ top:4, right:8, bottom:0, left:-20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#f1f5f9' }} itemStyle={{ color:'#ffffff' }} labelStyle={{ color:'#ffffff' }} />
                <Bar dataKey="value" radius={[6,6,0,0]} name="Adet">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. USERS TAB
// ---------------------------------------------------------------------------
function TabUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const { sorted, sortKey, sortDir, toggleSort } = useSortedData(users, 'id')
  const [showAdd, setShowAdd] = useState(false)
  const [editRole, setEditRole] = useState(null)
  const [delId, setDelId]     = useState(null)
  const [delLoading, setDelLoading] = useState(false)
  const [delError, setDelError] = useState(null)

  const load = useCallback(()=>{
    setLoading(true)
    adminApi.getUsers().then(r=>setUsers(r.data.data||[])).finally(()=>setLoading(false))
  },[])
  useEffect(()=>{ load() },[load])

  async function doDelete(id) {
    setDelLoading(true)
    setDelError(null)
    try {
      await adminApi.deleteUser(id)
      setUsers(p => p.filter(u => u.id !== id))
      setDelId(null)
    } catch(e) {
      setDelError(e.response?.data?.error || 'Silme işlemi başarısız.')
    } finally {
      setDelLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-xl font-bold text-white">Kullanıcılar</h2><p className="text-sm text-slate-400 mt-0.5">Tüm sistem kullanıcıları</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg transition"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"><Plus className="w-4 h-4" />Kullanıcı Ekle</button>
        </div>
      </div>

      {loading ? <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" />Yükleniyor...</div>
        : (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-700">
                  <Th col="id"         sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>#</Th>
                  <Th col="username"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>Kullanıcı Adı</Th>
                  <Th col="email"      sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>E-posta</Th>
                  <Th col="role"       sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>Rol</Th>
                  <Th col="created_at" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>Kayıt Tarihi</Th>
                  <th className="px-4 py-3 text-xs text-slate-500 uppercase tracking-wider text-right">İşlem</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-700/50">
                  {sorted.map(u=>(
                    <tr key={u.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">{u.id}</td>
                      <td className="px-4 py-3.5 font-medium text-white">{u.username}</td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs">{u.email}</td>
                      <td className="px-4 py-3.5"><RoleBadge role={u.role} /></td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{fmtDateShort(u.created_at)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={()=>setEditRole(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-purple-400/10 transition" title="Rol Değiştir"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={()=>setDelId(u.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition" title="Sil"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">Kullanıcı bulunamadı</div>}
          </div>
        )}

      {/* Add User Modal */}
      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="Yeni Kullanıcı Ekle">
        <AddUserForm
          onAdded={u=>{ setUsers(p=>[u,...p]); setShowAdd(false) }}
          onCancel={()=>setShowAdd(false)}
        />
      </Modal>

      {/* Edit Role Modal */}
      <Modal open={!!editRole} onClose={()=>setEditRole(null)} title={`Rol Değiştir — ${editRole?.username}`}>
        {editRole && <EditRoleForm
          user={editRole}
          onUpdated={u=>{ setUsers(p=>p.map(x=>x.id===u.id?u:x)); setEditRole(null) }}
          onCancel={()=>setEditRole(null)}
        />}
      </Modal>

      <ConfirmDelete open={!!delId} title="Kullanıcıyı Sil"
        desc={delError
          ? `Hata: ${delError}`
          : "Bu kullanıcı kalıcı olarak silinecek. Bu işlem geri alınamaz."}
        onConfirm={()=>doDelete(delId)} onCancel={()=>{ setDelId(null); setDelError(null) }} loading={delLoading} />
    </div>
  )
}

function AddUserForm({ onAdded, onCancel }) {
  const [form, setForm] = useState({ username:'', email:'', password:'', role:'citizen' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k,v) => { setForm(p=>({...p,[k]:v})); setError('') }

  async function submit(e) {
    e.preventDefault()
    if (!form.username.trim()||!form.email.trim()||!form.password) { setError('Tüm alanlar zorunludur.'); return }
    setLoading(true)
    try {
      const res = await adminApi.createUser(form.username.trim(), form.email.trim(), form.password, form.role)
      onAdded(res.data.data)
    } catch(err) { setError(err.response?.data?.message||'Kullanıcı eklenemedi.')
    } finally { setLoading(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-red-300 text-sm"><XCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
      <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Kullanıcı Adı</label><input value={form.username} onChange={e=>set('username',e.target.value)} className={inputCls} placeholder="kullanici_adi" /></div>
      <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">E-posta</label><input type="email" value={form.email} onChange={e=>set('email',e.target.value)} className={inputCls} placeholder="ornek@eposta.com" /></div>
      <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Şifre</label><input type="password" value={form.password} onChange={e=>set('password',e.target.value)} className={inputCls} placeholder="••••••••" /></div>
      <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Rol</label>
        <select value={form.role} onChange={e=>set('role',e.target.value)} className={selectCls}>
          <option value="citizen">Vatandaş</option>
          <option value="police">Polis</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2.5 rounded-lg transition text-sm">İptal</button>
        <button type="submit" disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 text-white font-medium py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Ekleniyor...</> : 'Kullanıcı Ekle'}
        </button>
      </div>
    </form>
  )
}

function EditRoleForm({ user, onUpdated, onCancel }) {
  const [role, setRole] = useState(user.role)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await adminApi.updateUserRole(user.id, role)
      onUpdated(res.data.data)
    } catch(err) { setError(err.response?.data?.message||'Güncellenemedi.')
    } finally { setLoading(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-red-300 text-sm"><XCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
      <div className="flex items-center gap-3 bg-slate-700/30 rounded-lg px-4 py-3 mb-2">
        <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-slate-300 font-bold text-sm">{user.username[0].toUpperCase()}</div>
        <div><p className="text-white font-medium text-sm">{user.username}</p><p className="text-slate-400 text-xs">{user.email}</p></div>
      </div>
      <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Yeni Rol</label>
        <select value={role} onChange={e=>setRole(e.target.value)} className={selectCls}>
          <option value="citizen">Vatandaş</option>
          <option value="police">Polis</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2.5 rounded-lg transition text-sm">İptal</button>
        <button type="submit" disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 text-white font-medium py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// 3. VEHICLES TAB
// ---------------------------------------------------------------------------
function TabVehicles() {
  const [vehicles, setVehicles] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const { sorted, sortKey, sortDir, toggleSort } = useSortedData(vehicles, 'id')
  const [showAdd, setShowAdd] = useState(false)
  const [delId, setDelId] = useState(null)
  const [delLoading, setDelLoading] = useState(false)

  const load = useCallback(()=>{
    setLoading(true)
    Promise.all([adminApi.getVehicles(), adminApi.getUsers()])
      .then(([vr, ur])=>{ setVehicles(vr.data.data||[]); setUsers(ur.data.data||[]) })
      .finally(()=>setLoading(false))
  },[])
  useEffect(()=>{ load() },[load])

  async function doDelete(id) {
    setDelLoading(true)
    try { await adminApi.deleteVehicle(id); setVehicles(p=>p.filter(v=>v.id!==id)) }
    finally { setDelLoading(false); setDelId(null) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-xl font-bold text-white">Araçlar</h2><p className="text-sm text-slate-400 mt-0.5">Sistemdeki tüm kayıtlı araçlar</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg transition"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"><Plus className="w-4 h-4" />Araç Ekle</button>
        </div>
      </div>

      {loading ? <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" />Yükleniyor...</div>
        : (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-700">
                  <Th col="id"    sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>#</Th>
                  <Th col="plate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>Plaka</Th>
                  <Th col="brand" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>Marka</Th>
                  <Th col="model" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>Model</Th>
                  <Th col="year"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>Yıl</Th>
                  <th className="text-left px-4 py-3 font-medium text-xs text-slate-500 uppercase tracking-wider">Sahip</th>
                  <Th col="created_at" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>Tarih</Th>
                  <th className="px-4 py-3 text-xs text-slate-500 uppercase tracking-wider text-right">İşlem</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-700/50">
                  {sorted.map(v=>(
                    <tr key={v.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">{v.id}</td>
                      <td className="px-4 py-3.5 font-bold text-white tracking-wider text-xs">{v.plate}</td>
                      <td className="px-4 py-3.5 text-slate-300">{v.brand}</td>
                      <td className="px-4 py-3.5 text-slate-300">{v.model}</td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs">{v.year}</td>
                      <td className="px-4 py-3.5">
                        {v.owner ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 bg-slate-700 rounded-md flex items-center justify-center text-xs font-bold text-slate-300">{v.owner.username[0].toUpperCase()}</div>
                            <span className="text-slate-300 text-xs">{v.owner.username}</span>
                          </div>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{fmtDateShort(v.created_at)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button onClick={()=>setDelId(v.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">Araç bulunamadı</div>}
          </div>
        )}

      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="Yeni Araç Ekle">
        <AddVehicleForm users={users} onAdded={v=>{ setVehicles(p=>[v,...p]); setShowAdd(false) }} onCancel={()=>setShowAdd(false)} />
      </Modal>

      <ConfirmDelete open={!!delId} title="Aracı Sil" desc="Bu araç kalıcı olarak silinecek."
        onConfirm={()=>doDelete(delId)} onCancel={()=>setDelId(null)} loading={delLoading} />
    </div>
  )
}

function AddVehicleForm({ users, onAdded, onCancel }) {
  const [form, setForm] = useState({ plate:'', brand:'', model:'', year:'', owner_id:'' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k,v) => { setForm(p=>({...p,[k]:v})); setError('') }

  async function submit(e) {
    e.preventDefault()
    const plateNorm = normalizePlate(form.plate)
    const plateErr  = validatePlate(plateNorm)
    if (plateErr) { setError(plateErr); return }
    if (!form.brand.trim()||!form.model.trim()||!form.year||!form.owner_id) { setError('Tüm alanlar zorunludur.'); return }
    setLoading(true)
    try {
      const res = await adminApi.createVehicle(plateNorm, form.brand, form.model, parseInt(form.year), parseInt(form.owner_id))
      onAdded(res.data.data)
    } catch(err) { setError(err.response?.data?.message||'Araç eklenemedi.')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-red-300 text-sm"><XCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
      <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Plaka</label><PlateInput value={form.plate} onChange={v=>set('plate',v)} className={inputCls} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Marka</label><input value={form.brand} onChange={e=>set('brand',e.target.value)} className={inputCls} placeholder="Toyota" /></div>
        <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Model</label><input value={form.model} onChange={e=>set('model',e.target.value)} className={inputCls} placeholder="Corolla" /></div>
      </div>
      <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Yıl</label><input type="number" value={form.year} onChange={e=>set('year',e.target.value)} className={inputCls} placeholder="2020" /></div>
      <div><label className="block text-sm text-slate-300 mb-1.5 font-medium">Araç Sahibi</label>
        <select value={form.owner_id} onChange={e=>set('owner_id',e.target.value)} className={selectCls}>
          <option value="">Kullanıcı seçin...</option>
          {users.map(u=><option key={u.id} value={u.id}>{u.username} ({ROLE_CFG[u.role]?.label})</option>)}
        </select>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2.5 rounded-lg transition text-sm">İptal</button>
        <button type="submit" disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 text-white font-medium py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Ekleniyor...</> : 'Araç Ekle'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// 4. VIOLATIONS TAB
// ---------------------------------------------------------------------------
function ViolationDetailModal({ violation, open, onClose }) {
  if (!violation) return null
  const vt = violation.violation_type || {}
  function Row({ icon, label, detected }) {
    return (
      <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${detected?'bg-red-500/10 border-red-500/30':'bg-green-500/10 border-green-500/30'}`}>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">{icon}{label}</div>
        {detected ? <span className="flex items-center gap-1 text-xs font-semibold text-red-400"><XCircle className="w-4 h-4" />Tespit</span>
          : <span className="flex items-center gap-1 text-xs font-semibold text-green-400"><CheckCircle2 className="w-4 h-4" />Temiz</span>}
      </div>
    )
  }
  return (
    <Modal open={open} onClose={onClose} title={`İhlal #${violation.id}`}>
      <div className="space-y-4">
        {violation.photo_url && (
          <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
            <img src={violation.photo_url} alt="İhlal" className="w-full object-cover max-h-60" onError={e=>{e.target.style.display='none'}} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            [<Calendar className="w-3.5 h-3.5" />,'Tarih', fmtDate(violation.created_at)],
            [<MapPin className="w-3.5 h-3.5" />,'Konum', violation.location],
            [<Car className="w-3.5 h-3.5" />,'Plaka', violation.plate],
            violation.speed != null && [<Gauge className="w-3.5 h-3.5" />,'Hız', `${violation.speed} km/h`],
          ].filter(Boolean).map(([icon,label,val],i)=>(
            <div key={i} className="bg-slate-700/30 border border-slate-700 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">{icon}{label}</div>
              <p className="text-sm text-white font-medium">{val||'—'}</p>
            </div>
          ))}
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Sonuçları</p>
            <AiBadge status={violation.ai_status} />
          </div>
          {violation.ai_status==='completed' ? (
            <div className="space-y-2">
              <Row icon={<Phone className="w-4 h-4" />} label="Telefon" detected={vt.phone} />
              <Row icon={<Cigarette className="w-4 h-4" />} label="Sigara" detected={vt.smoking} />
              <Row icon={<AlertTriangle className="w-4 h-4" />} label="Kemer" detected={vt.no_seatbelt} />
            </div>
          ) : <p className="text-sm text-slate-500 italic">AI analizi bekleniyor.</p>}
        </div>
      </div>
    </Modal>
  )
}

function TabViolations() {
  const [violations, setViolations] = useState([])
  const [loading, setLoading] = useState(true)
  const { sorted, sortKey, sortDir, toggleSort } = useSortedData(violations, 'id')
  const [filters, setFilters] = useState({ date_from:'', date_to:'', violation_type:'', ai_status:'' })
  const [detailV, setDetailV] = useState(null)
  const [delId, setDelId] = useState(null)
  const [delLoading, setDelLoading] = useState(false)

  const load = useCallback(()=>{
    setLoading(true)
    const params = Object.fromEntries(Object.entries(filters).filter(([,v])=>v))
    adminApi.getViolations(params).then(r=>setViolations(r.data.data||[])).finally(()=>setLoading(false))
  },[filters])
  useEffect(()=>{ load() },[load])

  async function doDelete(id) {
    setDelLoading(true)
    try { await adminApi.deleteViolation(id); setViolations(p=>p.filter(v=>v.id!==id)) }
    finally { setDelLoading(false); setDelId(null) }
  }

  const filterSelectCls = "bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition cursor-pointer"
  const filterInputCls  = "bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-xl font-bold text-white">İhlaller</h2><p className="text-sm text-slate-400 mt-0.5">Tüm sistem ihlalleri</p></div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg transition"><RefreshCw className="w-4 h-4" />Yenile</button>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">Başlangıç</label>
          <input type="date" value={filters.date_from} onChange={e=>setFilters(p=>({...p,date_from:e.target.value}))} className={filterInputCls + " w-full"} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">Bitiş</label>
          <input type="date" value={filters.date_to} onChange={e=>setFilters(p=>({...p,date_to:e.target.value}))} className={filterInputCls + " w-full"} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">İhlal Türü</label>
          <select value={filters.violation_type} onChange={e=>setFilters(p=>({...p,violation_type:e.target.value}))} className={filterSelectCls + " w-full"}>
            <option value="">Tümü</option>
            <option value="phone">Telefon</option>
            <option value="smoking">Sigara</option>
            <option value="no_seatbelt">Kemer</option>
            <option value="speed">Hız</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">AI Durumu</label>
          <select value={filters.ai_status} onChange={e=>setFilters(p=>({...p,ai_status:e.target.value}))} className={filterSelectCls + " w-full"}>
            <option value="">Tümü</option>
            <option value="pending">Bekliyor</option>
            <option value="processing">İşleniyor</option>
            <option value="completed">Tamamlandı</option>
            <option value="failed">Başarısız</option>
          </select>
        </div>
      </div>

      {loading ? <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" />Yükleniyor...</div>
        : (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-700">
                  <Th col="id"         sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>#</Th>
                  <Th col="created_at" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>Tarih</Th>
                  <Th col="plate"      sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>Plaka</Th>
                  <Th col="location"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>Konum</Th>
                  <th className="text-left px-4 py-3 font-medium text-xs text-slate-500 uppercase tracking-wider">İhlal</th>
                  <Th col="ai_status"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>AI</Th>
                  <th className="px-4 py-3 text-xs text-slate-500 uppercase tracking-wider text-right">İşlem</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-700/50">
                  {sorted.map(v=>(
                    <tr key={v.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">{v.id}</td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{fmtDate(v.created_at)}</td>
                      <td className="px-4 py-3.5 font-bold text-white tracking-wider text-xs">{v.plate}</td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs max-w-[130px] truncate">{v.location}</td>
                      <td className="px-4 py-3.5"><ViolationPills vt={v.violation_type} speed={v.speed} speedLimit={v.speed_limit} /></td>
                      <td className="px-4 py-3.5"><AiBadge status={v.ai_status} /></td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={()=>setDetailV(v)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition" title="Detay"><Eye className="w-4 h-4" /></button>
                          <button onClick={()=>setDelId(v.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition" title="Sil"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length===0 && <div className="py-12 text-center text-slate-500 text-sm">İhlal bulunamadı</div>}
            {sorted.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-700 text-xs text-slate-500">
                Toplam <span className="text-slate-300 font-medium">{sorted.length}</span> ihlal listeleniyor
              </div>
            )}
          </div>
        )}

      <ViolationDetailModal violation={detailV} open={!!detailV} onClose={()=>setDetailV(null)} />
      <ConfirmDelete open={!!delId} title="İhlali Sil" desc="Bu ihlal ve fotoğrafı kalıcı olarak silinecek."
        onConfirm={()=>doDelete(delId)} onCancel={()=>setDelId(null)} loading={delLoading} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main AdminPanel
// ---------------------------------------------------------------------------
const NAV = [
  { id:'dashboard', label:'Dashboard',  icon:LayoutDashboard },
  { id:'users',     label:'Kullanıcılar', icon:Users },
  { id:'vehicles',  label:'Araçlar',    icon:Car },
  { id:'violations',label:'İhlaller',   icon:FileWarning },
]

export default function AdminPanel() {
  const navigate = useNavigate()
  const user = getUser()
  const [active, setActive] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function handleLogout() {
    logout(navigate)
  }

  function NavItem({ id, label, Icon }) {
    const isActive = active === id
    return (
      <button onClick={()=>{ setActive(id); setSidebarOpen(false) }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
          isActive ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}>
        <Icon className="w-4 h-4 flex-shrink-0" />
        {label}
        {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
      </button>
    )
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
        <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Admin Panel</p>
          <p className="text-slate-500 text-xs">Trafik İhlal Sistemi</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(n=><NavItem key={n.id} id={n.id} label={n.label} Icon={n.icon} />)}
      </nav>

      {/* User info */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50 mb-2">
          <div className="w-7 h-7 bg-purple-600/20 border border-purple-600/30 rounded-lg flex items-center justify-center text-xs font-bold text-purple-300">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.username}</p>
            <RoleBadge role={user?.role} />
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition">
          <LogOut className="w-4 h-4" />Çıkış Yap
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-slate-900 border-r border-slate-800 flex-shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-slate-900 border-r border-slate-800">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 h-14 flex items-center justify-between sticky top-0 z-30">
          <button onClick={()=>setSidebarOpen(true)} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-600 rounded-md flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-semibold text-sm">Admin Panel</span>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition">
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Page title bar */}
        <div className="border-b border-slate-800 px-6 py-4 bg-slate-900/50">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="text-purple-400 font-medium">Admin</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white font-medium">{NAV.find(n=>n.id===active)?.label}</span>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 p-6">
          {active === 'dashboard'  && <TabDashboard />}
          {active === 'users'      && <TabUsers />}
          {active === 'vehicles'   && <TabVehicles />}
          {active === 'violations' && <TabViolations />}
        </main>
      </div>
    </div>
  )
}
