import { FFmpegManager } from './ffmpeg-manager.js';
import { DownloadManager } from './download-manager.js';
import { MESSAGE_TYPES, VIDEO_STATUS, TASK_STATUS } from '../shared/constants.js';
import { generateId } from '../shared/utils.js';

class BackgroundService {
  constructor() {
    this.ffmpegManager = null;
    this.downloadManager = null;
    this.tasks = new Map();
    this.ffmpegReady = false;
    this.init();
  }

  async init() {
    this.ffmpegManager = new FFmpegManager();
    this.downloadManager = new DownloadManager();

    this.setupMessageListeners();

    try {
      await this.ffmpegManager.load();
      this.ffmpegReady = true;
      console.log('Background service initialized with FFmpeg ready');
    } catch (error) {
      console.error('Failed to initialize FFmpeg:', error);
    }
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender).then(sendResponse).catch(error => {
        console.error('Message handler error:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;
    });
  }

  async handleMessage(message, sender) {
    const { type, payload } = message;

    switch (type) {
      case MESSAGE_TYPES.INIT_FFMPEG:
        return this.initializeFFmpeg();

      case MESSAGE_TYPES.SCAN_VIDEOS:
        return this.handleScanVideos(payload, sender);

      case MESSAGE_TYPES.DOWNLOAD_VIDEO:
        return this.handleDownloadVideo(payload);

      case MESSAGE_TYPES.PROCESS_VIDEO:
        return this.handleProcessVideo(payload);

      case MESSAGE_TYPES.PACK_VIDEOS:
        return this.handlePackVideos(payload);

      case MESSAGE_TYPES.GET_STATUS:
        return this.getStatus();

      case MESSAGE_TYPES.CANCEL_TASK:
        return this.cancelTask(payload.taskId);

      case MESSAGE_TYPES.CLEAR_CACHE:
        return this.clearCache();

      default:
        return { success: false, error: 'Unknown message type' };
    }
  }

  async initializeFFmpeg() {
    try {
      if (!this.ffmpegReady) {
        await this.ffmpegManager.load();
        this.ffmpegReady = true;
      }
      return { success: true, ready: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleScanVideos(payload, sender) {
    const tabId = sender.tab?.id;
    if (!tabId) {
      return { success: false, error: 'No tab ID' };
    }

    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.SCAN_VIDEOS,
        payload
      });
      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleDownloadVideo(payload) {
    const { video } = payload;
    const taskId = generateId();

    try {
      const task = {
        taskId,
        video,
        status: TASK_STATUS.DOWNLOADING,
        progress: 0,
        createdAt: Date.now()
      };

      this.tasks.set(taskId, task);

      this.notifyProgress(taskId, { status: 'downloading', progress: 0 });

      const result = await this.downloadManager.downloadVideo(
        video.url,
        video.title,
        (progress) => {
          this.notifyProgress(taskId, { status: 'downloading', progress });
        }
      );

      task.status = TASK_STATUS.COMPLETED;
      task.progress = 100;
      task.downloadedFile = result;

      return {
        success: true,
        taskId,
        result,
        status: TASK_STATUS.COMPLETED
      };

    } catch (error) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = TASK_STATUS.ERROR;
        task.error = error.message;
      }
      return { success: false, error: error.message, taskId };
    }
  }

  async handleProcessVideo(payload) {
    const { video, outputFormat } = payload;
    const taskId = generateId();

    try {
      if (!this.ffmpegReady) {
        await this.ffmpegManager.load();
        this.ffmpegReady = true;
      }

      const task = {
        taskId,
        video,
        status: TASK_STATUS.PROCESSING,
        progress: 0,
        createdAt: Date.now()
      };

      this.tasks.set(taskId, task);

      const result = await this.ffmpegManager.convertVideo(
        video.url,
        outputFormat || 'mp4',
        (progress) => {
          this.notifyProgress(taskId, { status: 'processing', progress });
        }
      );

      task.status = TASK_STATUS.COMPLETED;
      task.progress = 100;
      task.convertedFile = result;

      return {
        success: true,
        taskId,
        result,
        status: TASK_STATUS.COMPLETED
      };

    } catch (error) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = TASK_STATUS.ERROR;
        task.error = error.message;
      }
      return { success: false, error: error.message, taskId };
    }
  }

  async handlePackVideos(payload) {
    const { videos, format } = payload;
    const taskId = generateId();

    try {
      const task = {
        taskId,
        videos,
        status: TASK_STATUS.PACKAGING,
        progress: 0,
        createdAt: Date.now()
      };

      this.tasks.set(taskId, task);

      const result = await this.downloadManager.packVideos(
        videos,
        format || 'zip',
        (progress) => {
          this.notifyProgress(taskId, { status: 'packaging', progress });
        }
      );

      task.status = TASK_STATUS.COMPLETED;
      task.progress = 100;
      task.packageFile = result;

      return {
        success: true,
        taskId,
        result,
        status: TASK_STATUS.COMPLETED
      };

    } catch (error) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = TASK_STATUS.ERROR;
        task.error = error.message;
      }
      return { success: false, error: error.message, taskId };
    }
  }

  getStatus() {
    const tasks = Array.from(this.tasks.values());
    return {
      success: true,
      ffmpegReady: this.ffmpegReady,
      activeTasks: tasks.filter(t =>
        t.status !== TASK_STATUS.COMPLETED && t.status !== TASK_STATUS.ERROR
      ).length,
      totalTasks: tasks.length
    };
  }

  cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = TASK_STATUS.ERROR;
      task.error = 'Cancelled by user';
      return { success: true, taskId };
    }
    return { success: false, error: 'Task not found' };
  }

  async clearCache() {
    try {
      await chrome.storage.local.clear();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  notifyProgress(taskId, progress) {
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.STATUS_UPDATE,
      payload: { taskId, ...progress }
    }).catch(() => {});
  }
}

const service = new BackgroundService();
export default service;
