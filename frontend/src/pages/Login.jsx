import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { auth } from '../services/api'
import { saveAuth } from '../utils/auth'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Success message passed from Register page
  const successMsg = location.state?.successMsg || ''

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.username.trim() || !form.password) {
      setError('Kullanıcı adı ve şifre gereklidir.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await auth.login(form.username.trim(), form.password)
      const { token, user } = res.data.data

      saveAuth(token, user)

      if (user.role === 'admin') navigate('/admin', { replace: true })
      else if (user.role === 'police') navigate('/police', { replace: true })
      else navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.message || 'Giriş başarısız. Bilgilerinizi kontrol edin.'
      // E-posta doğrulanmamışsa OTP sayfasına yönlendir
      if (err.response?.status === 403 && msg.includes('doğrulanmamış')) {
        navigate('/verify-otp', { state: { email: form.username.includes('@') ? form.username : '', emailSent: false } })
        return
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="relative w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 mb-4">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Trafik İhlal Sistemi</h1>
          <p className="text-slate-400 text-sm mt-1">Güvenli giriş yapın</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Hesabınıza Girin</h2>

          {/* Success message from register */}
          {successMsg && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 mb-5">
              <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
              <p className="text-green-300 text-sm">{successMsg}</p>
            </div>
          )}

          {/* Error message */}
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
                  autoComplete="current-password"
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
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Giriş yapılıyor...
                </>
              ) : 'Giriş Yap'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            Hesabınız yok mu?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium transition">
              Kayıt Olun
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
