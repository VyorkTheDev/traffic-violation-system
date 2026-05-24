import { Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react'

export const AI_STATUS = {
  pending:    { label: 'Bekliyor',    color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  processing: { label: 'İşleniyor',  color: 'text-blue-400   bg-blue-400/10   border-blue-400/30'   },
  completed:  { label: 'Tamamlandı', color: 'text-green-400  bg-green-400/10  border-green-400/30'  },
  failed:     { label: 'Başarısız',  color: 'text-red-400    bg-red-400/10    border-red-400/30'    },
}

export default function AiBadge({ status }) {
  const s = AI_STATUS[status] || AI_STATUS.pending
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${s.color}`}>
      {status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
      {status === 'pending'    && <Clock className="w-3 h-3" />}
      {status === 'completed'  && <CheckCircle2 className="w-3 h-3" />}
      {status === 'failed'     && <XCircle className="w-3 h-3" />}
      {s.label}
    </span>
  )
}
