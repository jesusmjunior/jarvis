export interface Card {
  id: string;
  type: 'note' | 'research' | 'video' | 'report' | 'search' | 'image' | 'task' | 'map';
  title: string;
  content: string;
  timestamp: number;
  color: string;
  isCollapsed: boolean;
  isPinned: boolean;
  isArchived?: boolean;
  metadata?: any;
  sessionId?: string;
}
