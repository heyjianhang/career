// These types describe schemas/opportunity.v1.schema.json. Runtime inputs still
// pass through that schema before becoming typed records; optional fields stay
// optional so older files remain readable without rewriting their contents.
export const stages = {
  inbox: '待评估',
  preparing: '准备投递',
  applied: '已投递',
  interviewing: '面试中',
  offer: 'Offer',
  ended: '已结束',
};
export const outcomes = {
  rejected: '未通过',
  withdrawn: '主动放弃',
  closed: '岗位关闭',
  hired: '已入职',
};
export const interviewStatuses = {
  planned: '待进行',
  completed: '已完成',
  cancelled: '已取消',
};
export const platforms = {
  boss: 'BOSS 直聘',
  liepin: '猎聘',
  job51: '前程无忧',
  zhaopin: '智联招聘',
  website: '官网',
  referral: '内推',
  other: '其他',
};

export type Stage = keyof typeof stages;
export type Outcome = keyof typeof outcomes;
export type InterviewStatus = keyof typeof interviewStatuses;
export type Platform = keyof typeof platforms;
export type TaskStatus = 'pending' | 'in_progress' | 'waiting_user' | 'waiting_external' | 'done' | 'cancelled';
export type EvidenceType = 'user_report' | 'employer_message' | 'agent_analysis' | 'mock_interview' | 'real_interview';

export interface Source {
  platform: Platform;
  label?: string;
  url?: string;
  native_id?: string;
  captured_at?: string;
}
export interface Link {
  kind: 'document' | 'resume' | 'opportunity';
  target: string;
  label?: string;
  sha256?: string;
}
export interface ResumeReference {
  id: string;
  path: string;
}
export interface Submission {
  [key: string]: unknown;
  id: string;
  resume_id: string;
  resume_title: string;
  resume_sha256: string;
  snapshot: string;
  sha256: string;
  submitted_at: string;
  channel: string;
  theme: string;
}

// Persisted record schemas allow additional properties. Keep them as unknown
// and preserve them when updating known fields, rather than discarding them.
export interface Card {
  [key: string]: unknown;
  schema: 'career-opportunity/v1';
  id: string;
  company: string;
  title: string;
  stage: Stage | 'contacting' | 'archived';
  user_rating: number | null;
  sources: Source[];
  links: Link[];
  archived_reason: string | null;
  created_at: string;
  updated_at: string;
  location?: string | null;
  salary?: string | null;
  archived?: boolean;
  outcome?: Outcome | null;
  next_action?: { title: string; owner: 'user' | 'agent' | 'employer'; due?: string | null } | null;
  recommendation?: { rating: number; reason: string; evidence: string[]; assessed_at: string } | null;
  extensions?: Record<string, unknown>;
  resume?: ResumeReference | null;
  submissions?: Submission[];
}
export interface NormalizedCard extends Card {
  stage: Stage;
  archived: boolean;
  outcome: Outcome | null;
}
export type OpportunityPatch = Partial<Pick<Card,
  'company' | 'title' | 'location' | 'salary' | 'sources' | 'next_action' |
  'recommendation' | 'links' | 'archived_reason' | 'extensions' | 'archived' | 'outcome'
>> & { stage?: Stage; body?: string };
export type OpportunityInput = OpportunityPatch & Pick<Card, 'company' | 'title'>;

export interface Task {
  [key: string]: unknown;
  schema: 'career-task/v1';
  id: string;
  title: string;
  status: TaskStatus;
  owner: 'user' | 'agent';
  depends_on: string[];
  links: Link[];
  created_at: string;
  updated_at: string;
  assigned_to?: string | null;
  due?: string | null;
  outcome?: string | null;
}
export type TaskInput = Pick<Task, 'title' | 'status' | 'owner'> & Partial<Pick<Task,
  'id' | 'assigned_to' | 'due' | 'depends_on' | 'outcome' | 'links'
>> & { body?: string };

export interface Activity {
  [key: string]: unknown;
  schema: 'career-activity/v1';
  id: string;
  title: string;
  actor: string;
  kind: 'record_change' | 'note';
  created_at: string;
  evidence_type?: EvidenceType;
  occurred_at?: string;
  links?: Link[];
  target?: string;
  before_sha256?: string | null;
  after_sha256?: string;
}
export interface ActivityInput {
  title: string;
  evidence_type: EvidenceType;
  body: string;
  occurred_at?: string;
  links?: Link[];
}

export interface Interview {
  [key: string]: unknown;
  schema: 'career-interview/v1';
  id: string;
  title: string;
  status: InterviewStatus;
  created_at: string;
  updated_at: string;
  scheduled_at?: string | null;
}
export type InterviewInput = Pick<Interview, 'title'> & Partial<Pick<Interview,
  'id' | 'status' | 'scheduled_at'
>> & { body?: string };

export interface SchemaTypes {
  card: Card;
  task: Task;
  event: Activity;
  interview: Interview;
  create: OpportunityInput;
  update: OpportunityPatch;
  task_input: TaskInput;
  event_input: ActivityInput;
  interview_input: InterviewInput;
}
export type RecordKind = 'card' | 'task' | 'event' | 'interview';
export type RecordMetadata = SchemaTypes[RecordKind];
export interface RecordFile<T = RecordMetadata> {
  path: string;
  sha256: string;
  meta: T;
  body: string;
}
export interface Issue {
  path: string;
  code: string;
  message: string;
}
export interface Relation {
  from: string;
  kind: Link['kind'] | 'submission' | 'task' | 'file';
  target: string;
  label?: string;
  sha256?: string;
  resume_id?: string;
}
