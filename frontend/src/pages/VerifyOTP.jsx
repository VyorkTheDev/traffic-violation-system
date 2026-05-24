import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { ShieldCheck, AlertCircle, CheckCircle2, RefreshCw, Mail } from 'lucide-react'
import { auth } from '../services/api'
import { saveAuth } from '../utils/auth'

function rolePath(role) {
  if (role === 'admin')  return '/admin'
  if (role === 'police') return '/police'
  return '/dashboard'
}

export default function VerifyOTP() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const email     = location.state?.email     || ''
  const emailSent = location.state?.emailSent !== false

  // 6 ayrı input kutucuğu
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const inputRefs = useRef([])

  const [error,   setError]   = useState(emailSent ? '' : 'E-posta gönderilemedi. Kodu tekrar gönder butonunu kullanın.')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // E-posta yoksa register sayfasına gönder
  useEffect(() => {
    if (!email) navigate('/register', { replace: true })
  }, [email, navigate])

  // Geri sayım
  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [resendCooldown])

  function handleDigitChange(idx, value) {
    const char = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[idx] = char
    setDigits(next)
    setError('')
    if (char && idx < 5) inputRefs.current[idx + 1]?.focus()
  }

  function handleKeyDown(idx, e) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = ['', '', '', '', '', '']
    pasted.split('').forEach((c, i) => { next[i] = c })
    setDigits(next)
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const otp = digits.join('')
    if (otp.length < 6) { setError('Lütfen 6 haneli kodu eksiksiz girin.'); return }

    setLoading(true)
    setError('')
    try {
      const res = await auth.verifyOtp(email, otp)
      const { token, user } = res.data.data
      saveAuth(token, user)
      setSuccess('E-posta doğrulandı! Yönlendiriliyorsunuz...')
      setTimeout(() => navigate(rolePath(user.role), { replace: true }), 1200)
    } catch (err) {
      setError(err.response?.data?.message || 'Doğrulama başarısız. Lütfen tekrar deneyin.')
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || resendLoading) return
    setResendLoading(true)
    setError('')
    setSuccess('')
    try {
      await auth.resendOtp(email)
      setSuccess('Yeni kod gönderildi. Lütfen e-postanızı kontrol edin.')
      setResendCooldown(60)
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err) {
      setError(err.response?.data?.message || 'Kod gönderilemedi. Lütfen tekrar deneyin.')
    } finally {
      setResendLoading(false)
    }
  }

  const otp = digits.join('')

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
          <p className="text-slate-400 text-sm mt-1">E-posta doğrulama</p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl p-8">
          {/* Başlık */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Doğrulama Kodu</h2>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[240px]">{email}</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm mb-6 mt-3">
            E-posta adresinize gönderilen 6 haneli kodu girin. Kod <strong className="text-slate-300">10 dakika</strong> geçerlidir.
          </p>

          {/* Bildirimler */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 mb-5">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-green-300 text-sm">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* 6 kutucuk */}
            <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  disabled={loading}
                  className={`w-11 h-14 text-center text-xl font-bold rounded-lg border bg-slate-700/50 text-white
                    focus:outline-none focus:ring-2 transition
                    ${d ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-slate-600'}
                    focus:ring-blue-500 focus:border-blue-500
                    disabled:opacity-50`}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed
                text-white font-semibold py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-600/20
                flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Doğrulanıyor...
                </>
              ) : 'Doğrula'}
            </button>
          </form>

          {/* Tekrar gönder */}
          <div className="text-center mt-5">
            <p className="text-slate-400 text-sm mb-2">Kodu almadınız mı?</p>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || resendLoading}
              className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm font-medium
                disabled:text-slate-500 disabled:cursor-not-allowed transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resendLoading ? 'animate-spin' : ''}`} />
              {resendCooldown > 0
                ? `Tekrar gönder (${resendCooldown}s)`
                : resendLoading
                ? 'Gönderiliyor...'
                : 'Kodu Tekrar Gönder'}
            </button>
          </div>

          <p className="text-center text-slate-400 text-sm mt-5">
            <Link to="/register" className="text-slate-500 hover:text-slate-300 transition">
              ← Kayıt sayfasına dön
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
