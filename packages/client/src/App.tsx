import { useState, useEffect } from 'react';
import type { HealthResponse } from '@dnd-voice/shared';

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch health status');
        }
        return res.json();
      })
      .then((data: HealthResponse) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          DnD Voice Chat
        </h1>

        {loading && (
          <p className="text-gray-400">Loading...</p>
        )}

        {error && (
          <p className="text-red-500">Error: {error}</p>
        )}

        {health && (
          <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
            <p className="text-green-400 mb-2">✓ Server Status: {health.status}</p>
            <p className="text-gray-300">Default DM User: <span className="font-semibold text-white">{health.dmUser}</span></p>
          </div>
        )}

        <p className="text-gray-500 text-sm mt-6">
          Milestone 1: Full Stack Hello World
        </p>
      </div>
    </div>
  );
}

export default App;
