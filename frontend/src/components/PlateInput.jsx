import { normalizePlateInput, normalizePlate } from '../utils/plate'

/**
 * Türk plakası için özelleştirilmiş input.
 * - Yazarken: Türkçe karakterleri Latin'e çevirir, geçersiz karakterleri siler, büyük harfe çevirir
 * - Blur'da: boşlukları kaldırır (34ABC123 formatına normalize eder)
 * - API çağrılarında: normalizePlate(value) kullanın
 */
export default function PlateInput({ value, onChange, className = '', ...props }) {
  return (
    <input
      value={value}
      onChange={e => onChange(normalizePlateInput(e.target.value))}
      onBlur={() => {
        const n = normalizePlate(value)
        if (n !== value) onChange(n)
      }}
      placeholder="34 AB 123"
      maxLength={11}
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      className={className}
      {...props}
    />
  )
}
