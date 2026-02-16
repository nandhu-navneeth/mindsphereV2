import { useEffect, useState } from 'react';
import client from '../api/client';
import { RecommendationCard } from '../components/RecommendationCard';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { subscribeToPush } from '../utils/notifications';

interface Content {
  id: string;
  title: string;
  type: 'VIDEO' | 'ARTICLE' | 'MICRO_MODULE';
  duration: number;
  explanation: string;
}

export default function Home() {
  const { user, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshProfile();
  }, []);

  useEffect(() => {
    const fetchRecs = async () => {
      try {
        const res = await client.get('/api/content/recommendations');
        setRecommendations(res.data);
      } catch (error) {
        console.error('Failed to fetch recommendations', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecs();
  }, []);

  const handleStartSession = (id: string) => {
    navigate(`/session/${id}`);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading your personalized feed...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">MindSphere</h1>
            <p className="text-sm text-gray-500">Welcome back, {user?.name}</p>
          </div>
          <div className="flex gap-4 items-center">
            <button onClick={() => subscribeToPush()} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full hover:bg-indigo-200">
              Enable Notifications
            </button>
            <Link to="/survey" className="text-sm font-medium text-gray-600 hover:text-indigo-600">Preferences</Link>
            <Link to="/schedule" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">My Schedule</Link>
            <Link to="/analytics" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Insights</Link>
            {user?.role === 'ADMIN' && (
              <Link to="/admin" className="text-sm font-medium text-red-600 hover:text-red-800">Moderation</Link>
            )}
            <button onClick={logout} className="text-sm font-medium text-gray-500 hover:text-gray-900 border-l pl-4 ml-2">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <section className="mb-8">
          <div className="flex justify-between items-baseline mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Focus of the Day</h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">Anti-Doomscroll Mode</span>
          </div>

          {recommendations.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-xl shadow-sm">
              <p className="text-lg text-gray-600 mb-4">No recommendations yet.</p>
              <Link to="/survey" className="text-indigo-600 font-medium">Update your interests</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.map(rec => (
                <RecommendationCard key={rec.id} content={rec} onStart={handleStartSession} />
              ))}
            </div>
          )}
        </section>

        {/* Gamification Widget Placeholder */}
        <section className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold">Your Streak</h3>
              <p className="text-3xl font-extrabold mt-1">🔥 {user?.currentStreak || 0} Days</p>
            </div>
            <div>
              <p className="text-white/80 text-sm mb-1">XP Level {user?.level || 1}</p>
              <div className="w-32 h-2 bg-black/20 rounded-full overflow-hidden">
                <div className="h-full bg-white transition-all duration-500" style={{ width: `${((user?.currentXP || 0) % 100)}%` }} />
              </div>
              <p className="text-right text-xs mt-1">{user?.currentXP || 0} XP</p>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
