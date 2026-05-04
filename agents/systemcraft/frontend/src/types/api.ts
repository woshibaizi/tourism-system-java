export type Difficulty = 'easy' | 'medium' | 'hard';
export type ProjectStatus =
  | 'queued'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'completed'
  | 'error';
export type AgentRole =
  | 'pm'
  | 'architect'
  | 'developer'
  | 'qa'
  | 'mentor'
  | 'system'
  | string;

export interface AgentMessage {
  agent_role: AgentRole;
  agent_name: string;
  content: string;
  stage: string;
  msg_type: 'output' | 'thinking' | 'error' | string;
}

export interface LearningChatMessage {
  id: string;
  role: 'user' | 'mentor' | string;
  content: string;
  added_to_knowledge_cards?: boolean;
  source?: 'general' | 'exercise' | string;
  related_card_id?: string;
  related_card_title?: string;
  question?: string;
}

export interface ProjectSummary {
  id: string;
  owner_user_id: string;
  description: string;
  status: ProjectStatus;
  difficulty?: Difficulty;
  current_stage?: string;
  status_detail?: string;
  progress_percent?: number;
  progress_message?: string;
  project_name?: string;
  updated_at?: string;
  template_id?: string;
  template_label?: string;
  template_category?: string;
}

export interface IterationHistoryItem {
  id: string;
  change_request: string;
  created_at: string;
  status?: 'running' | 'completed' | 'failed';
  completed_at?: string;
  failed_at?: string;
  before_snapshot?: ProjectArtifactSnapshot;
  after_snapshot?: ProjectArtifactSnapshot;
}

export interface ProjectArtifactSnapshot {
  project_name?: string;
  requirements_doc?: string;
  architecture_doc?: string;
  code_artifacts?: string;
  test_report?: string;
  mentor_notes?: string;
  knowledge_cards?: string;
}

export interface ProjectDetail extends ProjectSummary {
  project_name?: string;
  requirements_doc?: string;
  architecture_doc?: string;
  code_artifacts?: string;
  test_report?: string;
  mentor_notes?: string;
  knowledge_cards?: string;
  iteration_count: number;
  current_stage?: string;
  status_detail?: string;
  progress_percent?: number;
  progress_message?: string;
  agent_messages: AgentMessage[];
  learning_chat: LearningChatMessage[];
  iteration_history?: IterationHistoryItem[];
}

export interface ProjectCreateRequest {
  description: string;
  difficulty: Difficulty;
  template_id?: string;
  template_label?: string;
  template_category?: string;
}

export interface FollowUpQuestionRequest {
  question: string;
  add_to_knowledge_cards: boolean;
  source?: 'general' | 'exercise' | string;
  related_card_id?: string;
  related_card_title?: string;
}

export interface FollowUpQuestionResponse {
  answer: string;
  card_added: boolean;
  project: ProjectDetail;
}

export interface LearningCardRequest {
  question: string;
  answer: string;
  mentor_message_id?: string;
  source?: 'general' | 'exercise' | string;
  related_card_id?: string;
  related_card_title?: string;
}

export interface LearningCardResponse {
  card_added: boolean;
  project: ProjectDetail;
}

export interface AuthUser {
  id: string;
  display_name: string;
  username: string;
  created_at?: string;
  last_login_at?: string;
  project_count: number;
}

export interface AuthRegisterRequest {
  display_name: string;
  username: string;
  password: string;
}

export interface AuthLoginRequest {
  username: string;
  password: string;
}

export interface AuthSessionResponse {
  token: string;
  user: AuthUser;
}

export interface AuthProfileUpdateRequest {
  display_name: string;
  username: string;
}

export interface AuthPasswordChangeRequest {
  current_password: string;
  new_password: string;
}

export interface ProjectUpdateRequest {
  project_name: string;
}

export interface ProjectIterationRequest {
  change_request: string;
}

export type ArtifactKey =
  | 'requirements_doc'
  | 'architecture_doc'
  | 'code_artifacts'
  | 'test_report'
  | 'mentor_notes'
  | 'knowledge_cards';

export interface ArtifactTab {
  key: ArtifactKey;
  label: string;
  description: string;
  content: string;
}

export interface KnowledgeCard {
  id: string;
  title: string;
  stage: string;
  concept: string;
  prompt: string;
  hasThinkingQuestion: boolean;
  source?: string;
  markdown: string;
}
