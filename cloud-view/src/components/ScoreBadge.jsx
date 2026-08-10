export default function ScoreBadge({ score, size = 'md' }) {
  if (score == null) return <span className="text-gray-600 text-xs">—</span>

  const { ring, text, bg } =
    score >= 80 ? { ring: 'ring-green-500',  text: 'text-green-300',  bg: 'bg-green-950'  } :
    score >= 65 ? { ring: 'ring-yellow-500', text: 'text-yellow-300', bg: 'bg-yellow-950' } :
    score >= 50 ? { ring: 'ring-orange-500', text: 'text-orange-300', bg: 'bg-orange-950' } :
                  { ring: 'ring-red-500',    text: 'text-red-300',    bg: 'bg-red-950'    }

  const sz = size === 'lg' ? 'w-14 h-14 text-base' : 'w-10 h-10 text-sm'

  return (
    <span className={`inline-flex items-center justify-center rounded-full ring-2 font-bold shrink-0 ${sz} ${ring} ${text} ${bg}`}>
      {score}
    </span>
  )
}
