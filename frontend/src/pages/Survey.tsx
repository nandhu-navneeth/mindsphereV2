import { useForm } from 'react-hook-form';
// import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { useNavigate } from 'react-router-dom';

interface PreferenceForm {
  topics: string[];
  dailyGoalMins: number;
  quietHoursStart: string;
  quietHoursEnd: string;
}

const TOPIC_OPTIONS = ['Technology', 'Health', 'History', 'Science', 'Productivity', 'Art'];

export default function Survey() {
  // const { updatePreferences } = useAuth(); // Removed
  const navigate = useNavigate();
  const { register, handleSubmit, watch, setValue } = useForm<PreferenceForm>({
    defaultValues: {
      topics: [],
      dailyGoalMins: 15,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00'
    }
  });

  const selectedTopics = watch('topics');

  const handleTopicToggle = (topic: string) => {
    if (selectedTopics.includes(topic)) {
      setValue('topics', selectedTopics.filter(t => t !== topic));
    } else {
      setValue('topics', [...selectedTopics, topic]);
    }
  };

  const onSubmit = async (data: PreferenceForm) => {
    try {
      await client.put('/api/profile/preferences', data);
      navigate('/');
    } catch (error: any) {
      console.error('Failed to save preferences', error);
      alert('Failed to save preferences');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-lg">
        <h2 className="mb-6 text-2xl font-bold text-center text-gray-900">Customize Your Experience</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Interests (Pick at least 1)</label>
            <div className="flex flex-wrap gap-2">
              {TOPIC_OPTIONS.map(topic => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => handleTopicToggle(topic)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border ${selectedTopics.includes(topic)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  {topic}
                </button>
              ))}
            </div>
            {/* Hidden input for validation if needed, or just handle manually */}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Daily Learning Goal (Minutes)</label>
            <input
              {...register('dailyGoalMins', { valueAsNumber: true })}
              type="range"
              min="5"
              max="60"
              step="5"
              className="mt-2 w-full"
            />
            <div className="text-center text-sm text-gray-600">{watch('dailyGoalMins')} mins</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Quiet Hours Start</label>
              <input
                {...register('quietHoursStart')}
                type="time"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Quiet Hours End</label>
              <input
                {...register('quietHoursEnd')}
                type="time"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 py-2 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Save & Continue
          </button>
        </form>
      </div>
    </div>
  );
}
