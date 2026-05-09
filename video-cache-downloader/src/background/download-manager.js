import JSZip from 'jszip';
import { formatFileSize, sanitizeFilename, createProgressHandler } from '../shared/utils.js';

export class DownloadManager {
  constructor() {
    this.activeDownloads = new Map();
  }

  async downloadVideo(url, title, onProgress) {
    const progressHandler = createProgressHandler(onProgress || (() => {}));

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        received += value.length;

        if (total > 0) {
          const progress = Math.round((received / total) * 100);
          progressHandler(progress);
        }
      }

      const blob = new Blob(chunks);
      const filename = this.generateFilename(title, url);

      const blobUrl = URL.createObjectURL(blob);

      await chrome.downloads.download({
        url: blobUrl,
        filename: filename,
        saveAs: true
      });

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

      return {
        blob,
        url: blobUrl,
        filename,
        size: blob.size,
        sizeFormatted: formatFileSize(blob.size)
      };

    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  }

  async downloadBlob(blob, filename) {
    const blobUrl = URL.createObjectURL(blob);

    try {
      await chrome.downloads.download({
        url: blobUrl,
        filename: sanitizeFilename(filename),
        saveAs: true
      });

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

      return { success: true, filename };

    } catch (error) {
      URL.revokeObjectURL(blobUrl);
      throw error;
    }
  }

  async packVideos(videos, format = 'zip', onProgress) {
    const progressHandler = createProgressHandler(onProgress || (() => {}));

    try {
      const zip = new JSZip();
      const folder = zip.folder('videos');

      const totalVideos = videos.length;
      let processed = 0;

      for (const video of videos) {
        try {
          let blob;

          if (video.blob) {
            blob = video.blob;
          } else if (video.url) {
            const response = await fetch(video.url);
            blob = await response.blob();
          } else {
            console.warn('No blob or url for video:', video);
            processed++;
            progressHandler(Math.round((processed / totalVideos) * 50));
            continue;
          }

          const filename = this.generateFilename(video.title || 'video', video.url);
          folder.file(filename, blob);

          processed++;
          const progress = Math.round((processed / totalVideos) * 50);
          progressHandler(progress);

        } catch (error) {
          console.error('Failed to add video to zip:', error);
          processed++;
        }
      }

      progressHandler(50);

      const zipBlob = await zip.generateAsync(
        { type: 'blob' },
        (metadata) => {
          const progress = 50 + Math.round(metadata.percent * 0.5);
          progressHandler(progress);
        }
      );

      const zipFilename = `videos_${Date.now()}.zip`;

      const blobUrl = URL.createObjectURL(zipBlob);

      await chrome.downloads.download({
        url: blobUrl,
        filename: zipFilename,
        saveAs: true
      });

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

      return {
        blob: zipBlob,
        url: blobUrl,
        filename: zipFilename,
        size: zipBlob.size,
        sizeFormatted: formatFileSize(zipBlob.size),
        videoCount: videos.length
      };

    } catch (error) {
      console.error('Pack error:', error);
      throw error;
    }
  }

  generateFilename(title, url) {
    const baseName = sanitizeFilename(title || 'video');
    const timestamp = Date.now();

    const ext = this.getExtension(url);
    const safeExt = ext ? `.${ext}` : '.mp4';

    const maxLength = 100 - safeExt.length - 20;
    const truncatedName = baseName.substring(0, maxLength);

    return `${truncatedName}_${timestamp}${safeExt}`;
  }

  getExtension(url) {
    if (!url) return 'mp4';

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split('.');
      if (parts.length > 1) {
        const ext = parts[parts.length - 1].toLowerCase();
        if (['mp4', 'webm', 'ogg', 'ogv', 'mov', 'avi', 'mkv'].includes(ext)) {
          return ext;
        }
      }
    } catch (e) {}

    return 'mp4';
  }

  cancelDownload(downloadId) {
    if (this.activeDownloads.has(downloadId)) {
      chrome.downloads.cancel(downloadId);
      this.activeDownloads.delete(downloadId);
      return true;
    }
    return false;
  }

  async getDownloadInfo(downloadId) {
    try {
      const downloads = await chrome.downloads.search({ id: downloadId });
      return downloads.length > 0 ? downloads[0] : null;
    } catch (error) {
      console.error('Get download info error:', error);
      return null;
    }
  }

  async clearAllDownloads() {
    try {
      await chrome.downloads.erase({});
      this.activeDownloads.clear();
      return { success: true };
    } catch (error) {
      console.error('Clear downloads error:', error);
      throw error;
    }
  }
}
