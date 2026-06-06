import { Phone, Cigarette, AlertTriangle, Gauge } from 'lucide-react'

export default function ViolationPills({ vt, speed, speedLimit }) {
  const pills = []
  if (vt?.phone)       pills.push({ icon: <Phone className="w-3 h-3" />,         label: 'Telefon',   cls: 'bg-red-500/20 text-red-300 border-red-500/30' })
  if (vt?.smoking)     pills.push({ icon: <Cigarette className="w-3 h-3" />,     label: 'Sigara',    cls: 'bg-orange-500/20 text-orange-300 border-orange-500/30' })
  if (vt?.no_seatbelt) pills.push({ icon: <AlertTriangle className="w-3 h-3" />, label: 'Kemer',     cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' })
  if (speed != null && speedLimit != null && speed > speedLimit)
    pills.push({ icon: <Gauge className="w-3 h-3" />, label: `${speed} / ${speedLimit} km/h`, cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' })

  if (!pills.length) return <span className="text-xs text-slate-500">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {pills.map((p, i) => (
        <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${p.cls}`}>
          {p.icon}{p.label}
        </span>
      ))}
    </div>
  )
}
