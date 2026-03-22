export interface User {
  id: string;
  email: string;
  username: string;
}

export interface Task {
  id?: string;
  _id?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  status: 'processing' | 'ready' | 'in_progress' | 'done';
  created_at: string;
}

export interface SuggestionResponse {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
}

export interface AsyncSuggestionResponse {
  task_id: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}
