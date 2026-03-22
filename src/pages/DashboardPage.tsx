import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Task, SuggestionResponse, AsyncSuggestionResponse } from '../types';
import { useAuth } from '../context/AuthContext';
import { LogOut, Loader2, Save, Send, Trash2 } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [suggestion, setSuggestion] = useState<(SuggestionResponse & { id?: string }) | null>(null);
  const [pollingId, setPollingId] = useState<string | null>(null);

  // Fetch tasks
  const { data: tasks, isLoading: tasksLoading, isFetching: tasksFetching } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await api.get('/tasks');
      // Normalize _id to id for consistency
      return response.data.map((t: any) => ({
        ...t,
        id: t.id || t._id
      }));
    },
    refetchInterval: (query) => {
      const data = query.state.data as Task[] | undefined;
      // Poll list if there's any task in processing state
      const hasProcessing = data?.some(t => t.status === 'processing');
      return hasProcessing ? 3000 : false;
    }
  });

  // Polling for async suggestion (detailed view)
  const { data: polledTask } = useQuery<Task>({
    queryKey: ['task-poll', pollingId],
    queryFn: async () => {
      const response = await api.get(`/tasks/${pollingId}`);
      const data = response.data;
      if (data && data._id && !data.id) data.id = data._id;
      return data;
    },
    enabled: !!pollingId,
    refetchInterval: (query) => {
      const data = query.state.data as Task | undefined;
      // Stop polling when task is ready for review ('ready' status)
      if (data && (data.status === 'ready' || data.status === 'in_progress' || data.status === 'done')) {
        return false;
      }
      return 3000;
    },
  });

  // Effect to handle finished polling
  React.useEffect(() => {
    if (pollingId && polledTask) {
      console.log(`Polling task ${polledTask.id || polledTask._id} status: ${polledTask.status}`);
      
      if (polledTask.status === 'ready') {
        console.log('Task is ready for review!');
        setSuggestion({
          id: polledTask.id || polledTask._id,
          title: polledTask.title || '',
          description: polledTask.description || '',
          priority: polledTask.priority || 'medium',
          tags: polledTask.tags || [],
        });
        setPollingId(null);
        // Refresh the main list too so "Processing..." changes to the new status
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } else if (polledTask.status === 'in_progress' || polledTask.status === 'done') {
        console.log('Task is already in advanced state!');
        setPollingId(null);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    }
  }, [polledTask, pollingId, queryClient]);

  // Async Suggestion Mutation
  const suggestMutation = useMutation<AsyncSuggestionResponse, Error, string>({
    mutationFn: async (text) => {
      const response = await api.post('/tasks/async-suggest', { text });
      return response.data;
    },
    onSuccess: (data) => {
      setPollingId(data.task_id);
      setSuggestion(null);
      // Invalidate tasks so the "processing" task appears in the list
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: any) => {
      console.error('Suggestion error:', err);
      alert(err.response?.data?.detail || 'Failed to get suggestion');
    }
  });

  // Save Task Mutation
  const saveMutation = useMutation<void, Error, SuggestionResponse & { id?: string }>({
    mutationFn: async (taskData) => {
      console.log('Saving task data:', taskData);
      if (taskData.id) {
        // If we have an ID (from async suggest), we update the existing task to finalize it
        // and change its status if needed (though backend might handle it on save)
        await api.patch(`/tasks/${taskData.id}`, taskData);
      } else {
        await api.post('/tasks', taskData);
      }
    },
    onSuccess: () => {
      console.log('Task saved successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSuggestion(null);
      setDescription('');
    },
    onError: (err: any) => {
      console.error('Save error:', err);
      alert(err.response?.data?.detail || 'Failed to save task');
    }
  });

  // Delete Task Mutation
  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to delete task');
    }
  });

  const handleSuggest = () => {
    if (description.trim()) {
      suggestMutation.mutate(description);
    }
  };

  const handleSave = () => {
    if (suggestion) {
      saveMutation.mutate(suggestion);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-gray-900">AI Task Tracker</h1>
            <button
              onClick={logout}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 bg-white hover:text-gray-700 focus:outline-none transition"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Suggestion Input */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-medium mb-4">New Task Suggestion</h2>
                <textarea
                  className="w-full h-32 p-3 border border-gray-300 rounded-md bg-white focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Describe your task in a messy way..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <button
                  onClick={handleSuggest}
                  disabled={suggestMutation.isPending || !!pollingId || !description.trim()}
                  className="mt-4 w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50"
                >
                  {suggestMutation.isPending || pollingId ? (
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  ) : (
                    <Send className="h-5 w-5 mr-2" />
                  )}
                  {pollingId ? 'Processing...' : 'Get Suggestion'}
                </button>
              </div>

              {suggestion && (
                <div className="bg-white p-6 rounded-lg shadow border-2 border-indigo-100">
                  <h2 className="text-lg font-medium mb-4">Suggestion Preview</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Title</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                        value={suggestion.title}
                        onChange={(e) => setSuggestion({ ...suggestion, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                        value={suggestion.description}
                        onChange={(e) => setSuggestion({ ...suggestion, description: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Priority</label>
                      <select
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                        value={suggestion.priority}
                        onChange={(e) => setSuggestion({ ...suggestion, priority: e.target.value as any })}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tags (comma separated)</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                        value={suggestion.tags.join(', ')}
                        onChange={(e) => setSuggestion({ ...suggestion, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                      />
                    </div>
                    <button
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none disabled:opacity-50"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      ) : (
                        <Save className="h-5 w-5 mr-2" />
                      )}
                      Save Task
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Task List */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium">Existing Tasks</h2>
                {tasksFetching && !tasksLoading && (
                  <Loader2 className="animate-spin h-4 w-4 text-gray-400" />
                )}
              </div>
              {tasksLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks?.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No tasks found. Try creating one!</p>
                  )}
                  {tasks?.map((task) => (
                    <div key={task.id || task._id} className="p-4 border rounded-lg hover:bg-gray-50 transition">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <h3 className={`font-bold flex items-center ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                            {task.title}
                            {task.status === 'processing' && (
                              <Loader2 className="animate-spin h-3 w-3 ml-2 text-indigo-500" />
                            )}
                          </h3>
                          <span className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          task.priority === 'high' ? 'bg-red-100 text-red-800' :
                          task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className={`text-sm mt-1 ${task.status === 'done' ? 'text-gray-300' : 'text-gray-600'}`}>
                        {task.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {task.tags.map((tag, i) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded ${task.status === 'done' ? 'bg-gray-50 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex justify-end items-center border-t pt-2">
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this task?')) {
                              deleteMutation.mutate((task.id || task._id)!);
                            }
                          }}
                          className="p-1 text-red-400 hover:text-red-600 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
