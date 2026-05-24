import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { auth } from '../services/api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate({ username, email, password, confirmPassword }) {
  if (!username.trim()) return 'Kullanıcı adı gereklidir.'
  if (username.trim().length < 3) return 'Kullanıcı adı en az 3 karakter olmalıdır.'
  if (!email.trim()) return 'E-posta gereklidir.'
  if (!EMAIL_RE.test(email.trim())) return 'Geçerli bir e-posta adresi girin.'
  if (!password) return 'Şifre gereklidir.'
  if (password.length < 6) return 'Şifre en az 6 karakter olmalıdır.'
  if (password !== confirmPassword) return 'Şifreler eşleşmiyor.'
  return null
}

function PasswordStrength({ password }) {
  if (!password) return null
  const checks = [
    { label: 'En az 6 karakter', pass: password.length >= 6 },
    { label: 'Büyük harf içeriyor', pass: /[A-Z]/.test(password) },
    { label: 'Rakam içeriyor', pass: /\d/.test(password) },
  ]
  const strength = checks.filter(c => c.pass).length
  const colors = ['bg-red-500', 'bg-yellow-500', 'bg-green-500']
  const labels = ['Zayıf', 'Orta', 'Güçlü']

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < strength ? colors[strength - 1] : 'bg-slate-600'}`} />
        ))}
      </div>
      <p className="text-xs text-slate-400">Şifre gücü: <span className={`font-medium ${['text-red-400','text-yellow-400','text-green-400'][strength-1] || 'text-slate-400'}`}>{labels[strength - 1] || '—'}</span></p>
      <ul className="space-y-0.5">
        {checks.map(c => (
          <li key={c.label} className={`flex items-center gap-1.5 text-xs ${c.pass ? 'text-green-400' : 'text-slate-500'}`}>
            <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationError = validate(form)
    if (validationError) { setError(validationError); return }

    setLoading(true)
    setError('')

    try {
      const res = await auth.register(form.username.trim(), form.email.trim(), form.password)
      const email = res.data?.data?.email || form.email.trim()
      const emailSent = res.data?.data?.email_sent !== false
      navigate('/verify-otp', { state: { email, emailSent } })
    } catch (err) {
      setError(err.response?.data?.message || 'Kayıt başarısız. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 mb-4">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Trafik İhlal Sistemi</h1>
          <p className="text-slate-400 text-sm mt-1">Yeni hesap oluşturun</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Kayıt Ol</h2>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Kullanıcı Adı
              </label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
                placeholder="kullanici_adi"
                className="w-full bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                E-posta
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                placeholder="ornek@eposta.com"
                className="w-full bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Şifre
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={form.password} />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Şifre Tekrar
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`w-full bg-slate-700/50 border text-white placeholder-slate-500 rounded-lg px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                    form.confirmPassword && form.password !== form.confirmPassword
                      ? 'border-red-500/60'
                      : form.confirmPassword && form.password === form.confirmPassword
                      ? 'border-green-500/60'
                      : 'border-slate-600'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-xs text-red-400 mt-1">Şifreler eşleşmiyor</p>
              )}
              {form.confirmPassword && form.password === form.confirmPassword && (
                <p className="text-xs text-green-400 mt-1">Şifreler eşleşiyor</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Kayıt yapılıyor...
                </>
              ) : 'Kayıt Ol'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            Zaten hesabınız var mı?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition">
              Giriş Yapın
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          &copy; {new Date().getFullYear()} Trafik İhlal Tespit Sistemi
        </p>
      </div>
    </div>
  )
}
