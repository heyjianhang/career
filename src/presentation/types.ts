export type Theme = string;
export type Platform = 'boss' | 'zhaopin' | 'liepin' | 'job51';
export interface ResumeLink {id:string;title:string;href:string;generated_at:string}
export interface WebLink {label:string;url:string}
export interface Contact {label:string;value:string;url?:string}
export interface CommonInfo {sections:{id:string;title:string;fields:Contact[]}[]}
export interface ResumeItem {id: string; title: string; subtitle?: string; period?: string; paragraphs: string[]; bullets: string[]; links?:WebLink[]}
export interface ResumeContent {
  name: string; headline: string; contacts: Contact[];
  photo?: {path:string; sha256:string; alt:string; position?:{x:number;y:number}};
  summary: string[]; sections: {id: string; title: string; items: ResumeItem[]}[];
}
export interface Report {sections: {id: string; kind: string; title: string; fields: {key: string; value: string}[]}[]; notes: string[]}
export interface Presentation {
  schema: 'career-presentation/v1'; id: string; title: string; generated_at: string; synthetic: boolean;
  source: {resume_id: string; files: {path: string; sha256: string}[]};
  resume: ResumeContent; common?:CommonInfo; reports: Partial<Record<Platform, Report>>;
}
export interface FieldRule {label: string; control: 'text'|'select'|'date'; max: number|null; min?: number; evidence: string}
export interface PlatformRules {name: string; revision: number; checked_at: string; coverage: string; fields: Record<string, FieldRule>; notes: string[]}
export interface Issue {code: string; path: string; message: string}
export interface ResolvedAssets {photo?: {dataUrl:string;alt:string;x:number;y:number}}
export interface Checked {bundle?:import('../resumes/model.js').ResumePackage; input: Presentation; rules: Record<Platform, PlatformRules>; warnings: Issue[]; assets:ResolvedAssets}
