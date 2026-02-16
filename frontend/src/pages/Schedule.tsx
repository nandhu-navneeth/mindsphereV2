
import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Calendar, Clock, RefreshCw, BarChart, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Content {
    id: string;
    title: string;
    type: string;
    duration: number;
    thumbnail?: string;
    url?: string;
}

interface StudySession {
    id: string;
    dayOffset: number;
    date: string;
    topic: string; // Sub-topic
    isCompleted: boolean;
    content?: Content;
}

interface StudyPlan {
    id: string;
    topic: string;
    difficulty: string;
    startDate: string;
    endDate: string;
    dailyMinutes: number;
    sessions: StudySession[];
}

export default function Schedule() {
    const { } = useAuth();
    const navigate = useNavigate();
    const [plan, setPlan] = useState<StudyPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const [formData, setFormData] = useState({
        topic: '',
        difficulty: 'Beginner',
        endDate: new Date(new Date().setDate(new Date().getDate() + 28)).toISOString().split('T')[0], // Default 4 weeks
        startDate: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchPlan();
    }, []);

    const fetchPlan = async () => {
        try {
            const res = await client.get('/api/schedule');
            if (res.data && res.data.id) {
                setPlan(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch plan', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setGenerating(true);
        try {
            const res = await client.post('/api/schedule/generate', {
                topic: formData.topic,
                difficulty: formData.difficulty,
                endDate: formData.endDate,
                startDate: formData.startDate
            });
            setPlan(res.data);
            // Poll for updates (hydration) - simple implementation: refresh after 5s
            setTimeout(() => fetchPlan(), 5000);
        } catch (error) {
            console.error('Failed to generate plan', error);
            alert('Failed to generate plan. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    const handleStartSession = (contentId?: string, sessionId?: string) => {
        if (contentId) {
            const url = sessionId
                ? `/session/${contentId}?studySessionId=${sessionId}`
                : `/session/${contentId}`;
            navigate(url);
        } else {
            alert("No content available for this session yet. Please wait for the system to find resources.");
        }
    };

    if (loading) return <div className="p-8 text-center">Loading study plan...</div>;

    // Helper to calculate days remaining
    const getDaysRemaining = (endDate: string) => {
        const diff = new Date(endDate).getTime() - new Date().getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };

    const getTotalDuration = (sessions: StudySession[]) => {
        const totalSeconds = sessions.reduce((acc, s) => acc + (s.content?.duration || 0), 0);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20 pt-8">
            <div className="max-w-7xl mx-auto px-4">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Your Study Plan</h1>
                    <p className="text-gray-500 mt-2">Structured learning path tailored to your goals.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Configuration Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
                            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                                <RefreshCw size={20} />
                                New Plan
                            </h2>

                            <form onSubmit={handleGenerate} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.topic}
                                        onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                        placeholder="e.g. React Native"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                                    <select
                                        value={formData.difficulty}
                                        onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="Beginner">Beginner</option>
                                        <option value="Intermediate">Intermediate</option>
                                        <option value="Advanced">Advanced</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={formData.startDate}
                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={generating}
                                    className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                >
                                    {generating ? 'Generating...' : 'Generate Plan'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Plan View */}
                    <div className="lg:col-span-3 space-y-6">
                        {!plan ? (
                            <div className="bg-white rounded-xl shadow-sm p-12 text-center h-full flex flex-col justify-center items-center">
                                <Layers className="w-16 h-16 text-gray-200 mb-4" />
                                <h3 className="text-xl font-medium text-gray-900 mb-2">No Active Study Plan</h3>
                                <p className="text-gray-500 max-w-md mx-auto">
                                    Create a new study plan to get a structured curriculum with daily content recommendations.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Plan Header */}
                                <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-indigo-500">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-900">{plan.topic}</h2>
                                            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                                                <span className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded"><BarChart size={16} className="text-gray-400" /> {plan.difficulty}</span>
                                                <span className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-medium"><Calendar size={16} /> Ends on {new Date(plan.endDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                                <span className="flex items-center gap-1.5 text-gray-500"><Clock size={16} /> {getDaysRemaining(plan.endDate)} days remaining</span>
                                                <span className="flex items-center gap-1.5 text-indigo-600 font-medium bg-indigo-50 px-2 py-1 rounded"><Layers size={16} /> Total: {getTotalDuration(plan.sessions)}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-3xl font-bold text-indigo-600">{Math.round((plan.sessions.filter(s => s.isCompleted).length / plan.sessions.length) * 100) || 0}%</div>
                                            <div className="text-xs text-gray-500 uppercase tracking-wide">Progress</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Sessions List */}
                                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                        <h3 className="font-semibold text-gray-900">Curriculum</h3>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {plan.sessions.map((session, index) => (
                                            <div key={session.id} className="p-6 hover:bg-gray-50 transition-colors group">
                                                <div className="flex flex-col md:flex-row gap-6">
                                                    {/* Date & Day */}
                                                    <div className="flex-shrink-0 w-24 text-center md:text-left">
                                                        <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Day {index + 1}</div>
                                                        <div className="text-lg font-semibold text-gray-900">{new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                                                        <div className="text-xs text-gray-500">{new Date(session.date).toLocaleDateString(undefined, { weekday: 'short' })}</div>
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-grow">
                                                        <h4 className="text-lg font-medium text-gray-900 mb-2">{session.topic}</h4>

                                                        {session.content ? (
                                                            <div className="bg-white border border-gray-200 rounded-lg p-3 flex gap-4 items-start shadow-sm group-hover:border-indigo-200 transition-colors">
                                                                {session.content.thumbnail && (
                                                                    <img src={session.content.thumbnail} alt="" className="w-24 h-16 object-cover rounded bg-gray-100" />
                                                                )}
                                                                <div className="flex-grow">
                                                                    <h5 className="font-medium text-gray-900 line-clamp-1">{session.content.title}</h5>
                                                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                                                        <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{session.content.type}</span>
                                                                        <span>
                                                                            {session.content.duration >= 86400
                                                                                ? `${Math.floor(session.content.duration / 86400)}d ${Math.floor((session.content.duration % 86400) / 3600)}h ${Math.floor((session.content.duration % 3600) / 60)}m`
                                                                                : session.content.duration >= 3600
                                                                                    ? `${Math.floor(session.content.duration / 3600)}h ${Math.floor((session.content.duration % 3600) / 60)}m`
                                                                                    : `${Math.floor(session.content.duration / 60)}:${(session.content.duration % 60).toString().padStart(2, '0')}`
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleStartSession(session.content?.id, session.id)}
                                                                    className="self-center bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                                                                >
                                                                    Start
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 flex gap-3 items-center text-sm text-yellow-700">
                                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-600 border-t-transparent"></div>
                                                                Finding best content for this topic...
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
