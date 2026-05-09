export const MESSAGE_TYPES = {
  SCAN_VIDEOS: 'SCAN_VIDEOS',
  SCAN_RESULT: 'SCAN_RESULT',
  DOWNLOAD_VIDEO: 'DOWNLOAD_VIDEO',
  DOWNLOAD_PROGRESS: 'DOWNLOAD_PROGRESS',
  DOWNLOAD_COMPLETE: 'DOWNLOAD_COMPLETE',
  DOWNLOAD_ERROR: 'DOWNLOAD_ERROR',
  PROCESS_VIDEO: 'PROCESS_VIDEO',
  PROCESS_PROGRESS: 'PROCESS_PROGRESS',
  PROCESS_COMPLETE: 'PROCESS_COMPLETE',
  PACK_VIDEOS: 'PACK_VIDEOS',
  PACK_PROGRESS: 'PACK_PROGRESS',
  PACK_COMPLETE: 'PACK_COMPLETE',
  CANCEL_TASK: 'CANCEL_TASK',
  GET_STATUS: 'GET_STATUS',
  STATUS_UPDATE: 'STATUS_UPDATE',
  INIT_FFMPEG: 'INIT_FFMPEG',
  FFMPEG_READY: 'FFMPEG_READY',
  FFMPEG_ERROR: 'FFMPEG_ERROR',
  CLEAR_CACHE: 'CLEAR_CACHE',
  CACHE_CLEARED: 'CACHE_CLEARED'
};

export const VIDEO_STATUS = {
  PENDING: 'pending',
  SCANNING: 'scanning',
  DETECTED: 'detected',
  DOWNLOADING: 'downloading',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
};

export const TASK_STATUS = {
  IDLE: 'idle',
  DOWNLOADING: 'downloading',
  PROCESSING: 'processing',
  PACKAGING: 'packaging',
  COMPLETED: 'completed',
  ERROR: 'error'
};

export const VIDEO_EXTENSIONS = [
  '.mp4', '.webm', '.ogg', '.ogv', '.mov', '.avi', '.mkv', '.m4v', '.flv', '.wmv'
];

export const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/x-flv',
  'video/x-ms-wmv'
];

export const MAX_CACHE_SIZE = 500 * 1024 * 1024;
export const MAX_RETRY_COUNT = 3;
export const RETRY_DELAY_BASE = 1000;
export const CHUNK_SIZE = 1024 * 1024;
export const PROGRESS_UPDATE_INTERVAL = 100;

export const DEFAULT_OUTPUT_FORMAT = 'mp4';
export const SUPPORTED_OUTPUT_FORMATS = ['mp4', 'webm'];
