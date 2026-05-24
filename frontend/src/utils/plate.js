// Türkçe özel karakter → Latin eşdeğeri
const TR_MAP = {
  'Ç': 'C', 'ç': 'C',
  'Ğ': 'G', 'ğ': 'G',
  'İ': 'I', 'i': 'I',
  'I': 'I', 'ı': 'I',
  'Ö': 'O', 'ö': 'O',
  'Ş': 'S', 'ş': 'S',
  'Ü': 'U', 'ü': 'U',
}

// Geçerli Türk plaka harfleri (Q, W, X dahil değil)
const PLATE_LETTERS = 'ABCDEFGHIJKLMNOPRSTUVYZ'

function applyTrMap(str) {
  return str.split('').map(c => TR_MAP[c] ?? c).join('')
}

/**
 * Yazarken normalize eder: Türkçe karakter dönüşümü, büyük harf, geçersiz char kaldır.
 * Boşluğa izin verir (kullanıcı "34 AB 123" yazabilsin diye).
 */
export function normalizePlateInput(raw) {
  return applyTrMap(raw)
    .toUpperCase()
    .replace(new RegExp(`[^0-9${PLATE_LETTERS}\\s]`, 'g'), '')
    .replace(/\s{2,}/g, ' ')
    .trimStart()
}

/**
 * API/DB için tam normalizasyon: boşlukları da kaldırır → "34ABC123"
 */
export function normalizePlate(raw) {
  return applyTrMap(raw)
    .toUpperCase()
    .replace(new RegExp(`[^0-9${PLATE_LETTERS}]`, 'g'), '')
}

// Validasyon regex: il kodu 01-81, 1H+4R | 2H+3R | 3H+1-2R
const PLATE_RE = new RegExp(
  `^(0[1-9]|[1-7][0-9]|8[01])`
  + `([${PLATE_LETTERS}]{1}[0-9]{4}`
  + `|[${PLATE_LETTERS}]{2}[0-9]{3,4}`
  + `|[${PLATE_LETTERS}]{3}[0-9]{2,4})$`
)

/**
 * Normalize edilmiş plakayı doğrular.
 * @returns {string|null} Hata mesajı veya geçerliyse null.
 */
export function validatePlate(plate) {
  if (!plate) return 'Plaka zorunludur'
  if (!PLATE_RE.test(plate)) return 'Geçersiz plaka (örn: 34 AB 123)'
  return null
}

/**
 * Normalize edilmiş plakayı okunabilir formata çevirir: "34AB123" → "34 AB 123"
 */
export function formatPlate(plate) {
  if (!plate) return plate
  return plate.replace(/^(\d+)([A-Z]+)(\d+)$/, '$1 $2 $3')
}
