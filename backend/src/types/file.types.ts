import type { Buffer } from 'node:buffer';

/**
 * 文件与存储管理的通用类型，艹，不准再乱用 any/unknown！
 */
export type FileCategory = 'temp' | 'intermediate' | 'userUpload' | 'result' | 'log';
export type FileLifecycleStatus = 'active' | 'expired' | 'deleted';
export type FilePriority = 'low' | 'normal' | 'high';
export type FileStorageClass = 'Standard' | 'Standard_IA' | 'Archive';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = Record<string, JsonValue | undefined>;

export type FileMetadata = JsonRecord;

export interface LifecycleTransitionConfig {
  after: number;
  storageClass: FileStorageClass;
}

export interface LifecycleStrategyConfig {
  ttl: number;
  transitions: LifecycleTransitionConfig[];
  autoDelete: boolean;
}

export interface LifecycleTransitionState {
  at: string;
  storageClass: FileStorageClass;
  completed: boolean;
  order: number;
  completedAt?: string;
}

export interface LifecycleSchedule {
  expiresAt: Date;
  transitions: LifecycleTransitionState[];
  nextTransitionAt: Date | null;
}

export interface LifecycleRegistrationInput {
  key: string;
  category: FileCategory;
  userId?: string;
  taskId?: string;
  metadata?: FileMetadata;
  priority?: FilePriority;
  size?: number;
  storageClass?: FileStorageClass;
}

export interface LifecycleRegistrationResult {
  success: boolean;
  fileId: string;
  schedule: LifecycleSchedule;
}

export interface LifecycleProcessResult {
  deleted: boolean;
  transferred: boolean;
  expired?: boolean;
}

export interface LifecycleTransitionErrorDetail {
  fileId?: string;
  key?: string;
  error: string;
}

export interface LifecycleTransitionExecutionResult {
  success: boolean;
  processed: number;
  transferred: number;
  deleted: number;
  errors: number;
  errorDetails: LifecycleTransitionErrorDetail[];
  timestamp: string;
}

export interface LifecycleCleanupOptions {
  category?: FileCategory | null;
  olderThanDays?: number;
  dryRun?: boolean;
  batchSize?: number;
}

export interface LifecycleCleanupResult {
  success: boolean;
  deletedCount: number;
  totalSize: number;
  category?: FileCategory | null;
  olderThanDays: number;
  dryRun: boolean;
  timestamp: string;
}

export interface FileLifecycleStats {
  totalProcessed: number;
  totalDeleted: number;
  totalTransferred: number;
  costSaved: number;
  lastCleanup: Date | null;
  errors: number;
}

export interface FileLifecycleRecordRow {
  id: string;
  key: string;
  category: FileCategory;
  task_id?: string | null;
  user_id?: string | null;
  metadata: string | null;
  storage_class: FileStorageClass;
  priority: FilePriority;
  status: FileLifecycleStatus;
  size?: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  expires_at: Date | string | null;
  next_transition_at: Date | string | null;
  transitions: string | null;
  auto_delete: number | boolean | null;
  deleted_at: Date | string | null;
}

export interface FileLifecycleRecord {
  id: string;
  key: string;
  category: FileCategory;
  task_id?: string | null;
  user_id?: string | null;
  metadata: FileMetadata;
  storage_class: FileStorageClass;
  priority: FilePriority;
  status: FileLifecycleStatus;
  size: number;
  created_at: Date;
  updated_at: Date;
  expires_at: Date | null;
  next_transition_at: Date | null;
  transitions: LifecycleTransitionState[];
  auto_delete: boolean;
  deleted_at: Date | null;
}

export interface LifecycleCategoryStat {
  category: FileCategory;
  count: number;
  totalSize: number;
}

export interface LifecycleStorageClassStat {
  storage_class: FileStorageClass;
  count: number;
}

export interface LifecycleStatsResponse {
  stats: FileLifecycleStats;
  categoryStats: LifecycleCategoryStat[];
  storageClassStats: LifecycleStorageClassStat[];
  expiringSoonCount: number;
  config: {
    cleanupInterval: number;
    batchSize: number;
  };
  timestamp: string;
}

export interface TaskFileRecordInput {
  taskId?: string;
  userId?: string;
  key: string;
  category: FileCategory;
  stepType?: string;
  resultIndex?: number;
  size?: number;
  originalUrl?: string | null;
  metadata?: FileMetadata;
  status?: 'active' | 'deleted';
  type?: string;
  inputFrom?: string;
  outputTo?: string;
  processingTime?: number;
}

export interface TaskFileRecord {
  id: string;
  task_id: string;
  user_id?: string | null;
  file_key: string;
  category: FileCategory;
  step_type?: string | null;
  result_index?: number | null;
  size?: number | null;
  original_url?: string | null;
  metadata: FileMetadata;
  status: 'active' | 'deleted';
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface TaskFileListOptions {
  categories?: FileCategory[] | null;
  includeDeleted?: boolean;
}

export interface TaskFileRecordSummary {
  key: string;
  category: FileCategory;
  stepType?: string;
  resultIndex?: number;
  createdAt: Date;
  lifecycleId?: string;
}

export interface TaskFileCleanupOptions {
  categories?: FileCategory[];
  force?: boolean;
  dryRun?: boolean;
}

export interface TaskFileCleanupResult {
  success: boolean;
  taskId: string;
  cleanedCount: number;
  totalFiles: number;
  cleanedFiles: TaskFileRecordSummary[];
  dryRun: boolean;
  timestamp: string;
}

export interface TaskFileListResponse {
  files: TaskFileRecord[];
  totalCount: number;
}

export interface UploadFileDescriptor {
  name: string;
  size: number;
  type?: string;
  path?: string;
  buffer?: Buffer;
}

export interface UploadProgress {
  percent: number;
  loaded: number;
  total?: number;
}

export interface StorageUploadMetadata extends FileMetadata {
  category: FileCategory;
  uploadTime: string;
  originalName?: string;
  uploadedBy?: string;
  uploadType?: string;
  taskId?: string;
  userId?: string;
  fileSize: number;
  fileType?: string;
  checksum: string;
}

export interface StorageUploadOptions {
  file: UploadFileDescriptor;
  category: FileCategory;
  metadata?: FileMetadata;
  key?: string;
  onProgress?: (progress: UploadProgress) => void;
}

export interface StorageUploadResult {
  success: true;
  key: string;
  url: string;
  metadata: StorageUploadMetadata;
  size: number;
  uploadTime: string;
}

export interface StorageDeleteResultItem {
  key: string;
  success: boolean;
  deleted: boolean;
}

export interface StorageDeleteResult {
  success: boolean;
  results: StorageDeleteResultItem[];
  total: number;
  deleted: number;
}

export interface StorageFileInfo {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
  storageClass: FileStorageClass;
  category: FileCategory | 'unknown';
}

export interface StorageFileListResult {
  success: boolean;
  files: StorageFileInfo[];
  directories: string[];
  isTruncated: boolean;
  nextMarker: string | null;
  totalCount: number;
}

export interface StorageCleanupOptions {
  categories?: FileCategory[];
  olderThanDays?: number;
  dryRun?: boolean;
  batchSize?: number;
}

export interface StorageCleanupResult {
  success: boolean;
  totalCleaned: number;
  totalSize: number;
  categories: FileCategory[];
  olderThanDays: number;
  dryRun: boolean;
  cleanupDate: string;
}

export interface StorageStatsByCategory {
  count: number;
  totalSize: number;
  averageSize: number;
}

export interface StorageStatsOverview {
  totalFiles: number;
  totalSize: number;
  averageSize: number;
}

export interface StorageStats {
  categoryStats: Record<FileCategory, StorageStatsByCategory>;
  overall: StorageStatsOverview;
  storageClassDistribution: Record<FileStorageClass, number>;
  lastCleanup: string | null;
}
