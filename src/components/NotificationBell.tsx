import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';

interface NotificationBellProps {
  tasks: any[]; // Assuming a task structure
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ tasks }) => {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    // Check if any tasks are completed but not acknowledged
    setHasUnread(tasks.some(task => task.status === 'completed' && !task.acknowledged));
  }, [tasks]);

  return (
    <div className="relative">
      <Bell className="w-6 h-6 text-zinc-400 cursor-pointer" />
      {hasUnread && (
        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-zinc-950" />
      )}
    </div>
  );
};
