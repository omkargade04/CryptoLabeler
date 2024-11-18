"use client";
import { BASE_URL } from "@/utils";
import { Appbar } from '@/components/Appbar';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { use } from 'react';

interface TaskOption {
  imageUrl: string;
}

interface TaskResult {
  count: number;
  option: TaskOption;
}

interface TaskDetails {
  title: string;
  description?: string;
  // Add other task detail fields as needed
}

interface TaskResponse {
  result: Record<string, TaskResult>;
  taskDetails: TaskDetails;
}

async function getTaskDetails(taskId: string) {
  try {
    const response = await axios.get<TaskResponse>(`${BASE_URL}/v1/user/task?taskId=${taskId}`, {
      headers: {
        "Authorization": localStorage.getItem("token")
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching task details:', error);
    throw error;
  }
}

export default function Page({ params }: { params: Promise<{ taskId: string }> }) {
  // Properly unwrap params using React.use()
  const { taskId } = use(params);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, TaskResult>>({});
  const [taskDetails, setTaskDetails] = useState<TaskDetails | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getTaskDetails(taskId);
        setResult(data.result);
        setTaskDetails(data.taskDetails);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load task details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [taskId]);

  if (loading) {
    return (
      <div>
        <Appbar />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Appbar />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-xl text-red-600">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Appbar />
      <div className="container mx-auto px-4">
        <div className="text-2xl text-black pt-20 flex justify-center">
          {taskDetails?.title || 'Untitled Task'}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
          {Object.entries(result).map(([taskId, data]) => (
            <Task 
              key={taskId} 
              imageUrl={data.option.imageUrl} 
              votes={data.count} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Task({ imageUrl, votes }: {
  imageUrl: string;
  votes: number;
}) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {!imageError ? (
        <img
          className="w-full h-64 object-cover"
          src={imageUrl}
          alt="Task option"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
          <span className="text-gray-500">Failed to load image</span>
        </div>
      )}
      <div className="p-4">
        <div className="text-center text-black text-lg font-medium">
          {votes} {votes === 1 ? 'vote' : 'votes'}
        </div>
      </div>
    </div>
  );
}