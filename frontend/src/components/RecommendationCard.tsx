import { Play, FileText, Clock } from 'lucide-react';

interface Content {
  id: string;
  title: string;
  type: 'VIDEO' | 'ARTICLE' | 'MICRO_MODULE';
  duration: number; // seconds
  thumbnail?: string;
  explanation?: string;
}

export function RecommendationCard({ content, onStart }: { content: Content; onStart: (id: string) => void }) {
  const formatDuration = (sec: number) => {
    if (sec >= 86400) {
      return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
    }
    if (sec >= 3600) {
      return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
    }
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${min}:${s.toString().padStart(2, '0')}` : `${min} min`;
  };

  return (
    <div className="flex flex-col rounded-xl bg-white shadow-md overflow-hidden hover:shadow-lg transition-shadow border border-gray-100">
      <div className="h-40 w-full bg-gray-200 relative">
        {content.thumbnail ? (
          <img src={content.thumbnail} alt={content.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-indigo-50 text-indigo-200">
            {content.type === 'VIDEO' ? <Play size={48} /> : <FileText size={48} />}
          </div>
        )}
        <div className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white flex items-center gap-1">
          <Clock size={12} />
          {formatDuration(content.duration)}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${content.type === 'VIDEO' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
            }`}>
            {content.type}
          </span>
        </div>

        <h3 className="text-lg font-bold text-gray-900 mb-1 leading-tight">{content.title}</h3>

        {content.explanation && (
          <p className="text-xs text-gray-500 italic mt-auto border-t pt-2 border-gray-100">
            ✨ {content.explanation}
          </p>
        )}

        <button
          onClick={() => onStart(content.id)}
          className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.98] transition-all"
        >
          Start Session
        </button>
      </div>
    </div>
  );
}
