import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { saveEventToBuffer } from '../utils/syncManager';
import { ArrowLeft, Clock, BookOpen } from 'lucide-react';

export default function SessionRunner() {
  const { contentId } = useParams();
  const [searchParams] = useSearchParams();
  const studySessionId = searchParams.get('studySessionId');
  const navigate = useNavigate();
  const backPath = studySessionId ? '/schedule' : '/';
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [content, setContent] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = async () => {
      try {
        const res = await client.post('/api/sessions/start', {
          contentId,
          ...(studySessionId ? { studySessionId } : {})
        });
        setSessionId(res.data.id);
        setContent(res.data.content);
      } catch (error) {
        console.error(error);
        alert('Failed to start session');
        navigate(backPath);
      }
    };
    if (contentId) start();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [contentId, navigate]);

  useEffect(() => {
    if (sessionId) {
      timerRef.current = setInterval(() => {
        setElapsed(e => e + 1);

        // Log "Heartbeat" VIEW event every 30s to buffer
        if (elapsed > 0 && elapsed % 30 === 0) {
          saveEventToBuffer({
            sessionId,
            type: 'VIEW',
            timestamp: new Date().toISOString()
          });
        }
      }, 1000);
    }
    return () => clearInterval(timerRef.current!);
  }, [sessionId, elapsed]);

  const handleFinish = async () => {
    if (!sessionId) return;
    try {
      // Final event
      await saveEventToBuffer({
        sessionId,
        type: 'COMPLETE',
        timestamp: new Date().toISOString()
      });

      // End session
      await client.post('/api/sessions/end', { sessionId, duration: elapsed });

      navigate(backPath);
    } catch (error) {
      console.error('Failed to end session', error);
      // Even if API fails, navigate back. Background sync will handle events.
      // Ideally queue the "End Session" request too in SyncManager, but for MVP keep simple.
      navigate(backPath);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const renderContent = () => {
    if (!content) return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
        <p className="text-zinc-400">Loading content...</p>
      </div>
    );

    if (content.type === 'VIDEO' || content.url?.includes('youtube') || content.url?.includes('youtu.be')) {
      const videoId = content.url?.split('v=')[1]?.split('&')[0] || content.url?.split('/').pop();
      const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;

      return (
        <iframe
          src={embedUrl}
          title={content.title}
          className="w-full h-full rounded-xl"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }

    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">{content.title}</h2>
        <p className="text-zinc-400 mb-6">This content involves reading or external practice.</p>
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition"
        >
          Open Resource <BookOpen size={20} />
        </a>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="p-4 flex justify-between items-center bg-zinc-900">
        <button onClick={() => navigate(backPath)} className="text-gray-400 hover:text-white" aria-label="Go back">
          <ArrowLeft />
        </button>
        <div className="flex items-center gap-2 font-mono text-xl">
          <Clock size={20} className="text-indigo-400" />
          {formatTime(elapsed)}
        </div>
        <div />
      </header>

      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-5xl w-full aspect-video bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800 shadow-2xl overflow-hidden relative">
          {renderContent()}
        </div>
      </main>

      <footer className="p-8 flex justify-center bg-zinc-900 border-t border-zinc-800">
        <button
          onClick={handleFinish}
          className="px-8 py-3 bg-red-600 rounded-full font-bold hover:bg-red-700 transition shadow-lg hover:shadow-red-900/20"
        >
          End Session
        </button>
      </footer>
    </div>
  );
}
