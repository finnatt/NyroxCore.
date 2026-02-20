export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface Chat {
  id: string;
  title: string;
  model_provider: 'openai' | 'gemini';
  mode: 'chat' | 'ide';
  project_name?: string;
  created_at: string;
}

export interface Settings {
  openai_key?: string;
  gemini_key?: string;
  last_provider?: 'openai' | 'gemini';
}
