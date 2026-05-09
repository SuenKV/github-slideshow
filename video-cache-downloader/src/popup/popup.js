import { MESSAGE_TYPES, VIDEO_STATUS, TASK_STATUS } from '../shared/constants.js';
import { formatFileSize, formatDuration } from '../shared/utils.js';

class PopupApp {
  constructor() {
    this.videos = [];
    this.selectedVideos = new Set();
    this.currentTabId = null;
    this.ffmpegReady = false;
    this.isProcessing = false;
    this.currentProgress = 0;
    this.init();
  }

  async init() {
    this.cacheElements();
    this.bindEvents();
    await this.getCurrentTab();
    await this.checkFFmpegStatus();
    this.updateUI();
  }

  cacheElements() {
    this.elements = {
      scanBtn: document.getElementById('scanBtn'),
      selectAllBtn: document.getElementById('selectAllBtn'),
      videoList: document.getElementById('videoList'),
      statusText: document.getElementById('statusText'),
      actionBar: document.getElementById('actionBar'),
      selectedCount: document.getElementById('selectedCount'),
      totalSize: document.getElementById('totalSize'),
      downloadBtn: document.getElementById('downloadBtn'),
      convertBtn: document.getElementById('convertBtn'),
      packBtn: document.getElementById('packBtn'),
      progressSection: document.getElementById('progressSection'),
      progressLabel: document.getElementById('progressLabel'),
      progressPercent: document.getElementById('progressPercent'),
      progressFill: document.getElementById('progressFill'),
      progressDetail: document.getElementById('progressDetail'),
      formatModal: document.getElementById('formatModal'),
      confirmFormatBtn: document.getElementById('confirmFormatBtn'),
      cancelFormatBtn: document.getElementById('cancelFormatBtn'),
      closeModalBtn: document.getElementById('closeModalBtn'),
      settingsBtn: document.getElementById('settingsBtn')
    };
  }

  bindEvents() {
    this.elements.scanBtn.addEventListener('click', () => this.scanVideos());
    this.elements.selectAllBtn.addEventListener('click', () => this.toggleSelectAll());
    this.elements.downloadBtn.addEventListener('click', () => this.downloadSelected());
    this.elements.convertBtn.addEventListener('click', () => this.showFormatModal());
    this.elements.packBtn.addEventListener('click', () => this.packSelected());
    this.elements.confirmFormatBtn.addEventListener('click', () => this.convertSelected());
    this.elements.cancelFormatBtn.addEventListener('click', () => this.hideFormatModal());
    this.elements.closeModalBtn.addEventListener('click', () => this.hideFormatModal());
    this.elements.formatModal.addEventListener('click', (e) => {
      if (e.target === this.elements.formatModal) this.hideFormatModal();
    });

    chrome.runtime.onMessage.addListener((message) => this.handleBackgroundMessage(message));
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTabId = tab?.id;
    } catch (error) {
      console.error('Failed to get current tab:', error);
    }
  }

  async checkFFmpegStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_STATUS
      });
      this.ffmpegReady = response?.ffmpegReady || false;
    } catch (error) {
      console.error('Failed to check FFmpeg status:', error);
    }
  }

  async scanVideos() {
    if (!this.currentTabId) return;

    this.setScanning(true);
    this.elements.statusText.textContent = chrome.i18n.getMessage('scanning') || '正在扫描...';
    this.elements.statusText.classList.add('scanning-animation');

    try {
      const response = await chrome.tabs.sendMessage(this.currentTabId, {
        type: MESSAGE_TYPES.SCAN_VIDEOS
      });

      if (response?.success) {
        this.videos = response.videos || [];
        this.selectedVideos.clear();
        this.renderVideoList();
        this.updateStatus();
      } else {
        throw new Error(response?.error || 'Scan failed');
      }

    } catch (error) {
      console.error('Scan error:', error);
      this.elements.statusText.textContent = `扫描失败: ${error.message}`;
      this.videos = [];
      this.renderVideoList();
    } finally {
      this.setScanning(false);
      this.elements.statusText.classList.remove('scanning-animation');
    }
  }

  setScanning(isScanning) {
    this.isProcessing = isScanning;
    this.elements.scanBtn.disabled = isScanning;
    this.elements.selectAllBtn.disabled = this.videos.length === 0;
  }

  renderVideoList() {
    if (this.videos.length === 0) {
      this.elements.videoList.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
            <line x1="7" y1="2" x2="7" y2="22"></line>
            <line x1="17" y1="2" x2="17" y2="22"></line>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <line x1="2" y1="7" x2="7" y2="7"></line>
            <line x1="2" y1="17" x2="7" y2="17"></line>
            <line x1="17" y1="17" x2="22" y2="17"></line>
            <line x1="17" y1="7" x2="22" y2="7"></line>
          </svg>
          <p class="empty-text">${chrome.i18n.getMessage('noVideosFound') || '未检测到视频'}</p>
        </div>
      `;
      return;
    }

    this.elements.videoList.innerHTML = this.videos.map(video => this.createVideoCard(video)).join('');

    this.elements.videoList.querySelectorAll('.video-card').forEach(card => {
      const videoId = card.dataset.id;
      const checkbox = card.querySelector('input[type="checkbox"]');

      card.addEventListener('click', (e) => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        this.toggleVideoSelection(videoId, checkbox.checked);
      });

      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        this.toggleVideoSelection(videoId, e.target.checked);
      });

      const retryBtn = card.querySelector('.retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.retryDownload(videoId);
        });
      }
    });
  }

  createVideoCard(video) {
    const isSelected = this.selectedVideos.has(video.id);
    const duration = formatDuration(video.duration);
    const size = video.size > 0 ? formatFileSize(video.size) : chrome.i18n.getMessage('unknownSize') || '未知';

    const thumbnail = video.thumbnail
      ? `<img src="${video.thumbnail}" alt="thumbnail">`
      : `<svg class="placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>`;

    const statusBadge = this.createStatusBadge(video);

    return `
      <div class="video-card ${isSelected ? 'selected' : ''} ${video.status || ''}" data-id="${video.id}">
        <div class="video-checkbox">
          <input type="checkbox" ${isSelected ? 'checked' : ''}>
        </div>
        <div class="video-thumbnail">
          ${thumbnail}
        </div>
        <div class="video-info">
          <div class="video-title" title="${video.title}">${video.title}</div>
          <div class="video-meta">
            <span>⏱ ${duration}</span>
            <span>💾 ${size}</span>
          </div>
        </div>
        ${statusBadge}
      </div>
    `;
  }

  createStatusBadge(video) {
    if (video.status === VIDEO_STATUS.COMPLETED) {
      return `<div class="video-status completed">✓ 完成</div>`;
    }
    if (video.status === VIDEO_STATUS.ERROR) {
      return `<div class="video-status error">
        ✗ 失败
        <button class="retry-btn icon-btn" title="${chrome.i18n.getMessage('retry') || '重试'}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
      </div>`;
    }
    if (video.status === VIDEO_STATUS.DOWNLOADING || video.status === VIDEO_STATUS.PROCESSING) {
      const label = video.status === VIDEO_STATUS.DOWNLOADING ? '下载中' : '处理中';
      return `<div class="video-status ${video.status}">${label}</div>`;
    }
    return `<div class="video-status pending">待下载</div>`;
  }

  toggleVideoSelection(videoId, selected) {
    if (selected) {
      this.selectedVideos.add(videoId);
    } else {
      this.selectedVideos.delete(videoId);
    }

    const card = this.elements.videoList.querySelector(`[data-id="${videoId}"]`);
    if (card) {
      card.classList.toggle('selected', selected);
      card.querySelector('input[type="checkbox"]').checked = selected;
    }

    this.updateSelectionInfo();
  }

  toggleSelectAll() {
    const allSelected = this.selectedVideos.size === this.videos.length;

    if (allSelected) {
      this.selectedVideos.clear();
      this.elements.selectAllBtn.querySelector('span').textContent =
        chrome.i18n.getMessage('selectAll') || '全选';
    } else {
      this.videos.forEach(video => this.selectedVideos.add(video.id));
      this.elements.selectAllBtn.querySelector('span').textContent =
        chrome.i18n.getMessage('deselectAll') || '取消全选';
    }

    this.renderVideoList();
    this.updateSelectionInfo();
  }

  updateSelectionInfo() {
    const count = this.selectedVideos.size;
    const selectedVideos = this.videos.filter(v => this.selectedVideos.has(v.id));
    const totalSize = selectedVideos.reduce((sum, v) => sum + (v.size || 0), 0);

    this.elements.selectedCount.textContent =
      chrome.i18n.getMessage('selectedCount', [String(count)]) || `已选择 ${count} 个`;
    this.elements.totalSize.textContent =
      chrome.i18n.getMessage('totalSize', [formatFileSize(totalSize)]) || `总计: ${formatFileSize(totalSize)}`;

    const hasSelection = count > 0;
    this.elements.downloadBtn.disabled = !hasSelection;
    this.elements.convertBtn.disabled = !hasSelection || !this.ffmpegReady;
    this.elements.packBtn.disabled = count < 2;
    this.elements.actionBar.classList.toggle('hidden', !hasSelection);
  }

  updateStatus() {
    const count = this.videos.length;
    this.elements.statusText.textContent =
      chrome.i18n.getMessage('videoCount', [String(count)]) || `共 ${count} 个视频`;
    this.elements.selectAllBtn.disabled = count === 0;
  }

  updateUI() {
    this.updateSelectionInfo();
    this.updateStatus();
  }

  async downloadSelected() {
    const selectedVideos = this.videos.filter(v => this.selectedVideos.has(v.id));
    if (selectedVideos.length === 0) return;

    this.setProcessing(true, 'downloading');

    for (const video of selectedVideos) {
      this.updateVideoStatus(video.id, VIDEO_STATUS.DOWNLOADING);

      try {
        const response = await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.DOWNLOAD_VIDEO,
          payload: { video }
        });

        if (response.success) {
          this.updateVideoStatus(video.id, VIDEO_STATUS.COMPLETED);
        } else {
          throw new Error(response.error);
        }

      } catch (error) {
        console.error('Download error:', error);
        this.updateVideoStatus(video.id, VIDEO_STATUS.ERROR, error.message);
      }
    }

    this.setProcessing(false);
    this.renderVideoList();
  }

  async convertSelected() {
    const selectedVideos = this.videos.filter(v => this.selectedVideos.has(v.id));
    if (selectedVideos.length === 0) return;

    const format = document.querySelector('input[name="format"]:checked')?.value || 'mp4';
    this.hideFormatModal();

    this.setProcessing(true, 'processing');

    for (const video of selectedVideos) {
      this.updateVideoStatus(video.id, VIDEO_STATUS.PROCESSING);

      try {
        const response = await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.PROCESS_VIDEO,
          payload: { video, outputFormat: format }
        });

        if (response.success) {
          const downloadResponse = await chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.DOWNLOAD_VIDEO,
            payload: {
              video: {
                ...video,
                title: `${video.title}_${format}`,
                blob: response.result.blob
              }
            }
          });

          if (downloadResponse.success) {
            this.updateVideoStatus(video.id, VIDEO_STATUS.COMPLETED);
          } else {
            throw new Error(downloadResponse.error);
          }
        } else {
          throw new Error(response.error);
        }

      } catch (error) {
        console.error('Convert error:', error);
        this.updateVideoStatus(video.id, VIDEO_STATUS.ERROR, error.message);
      }
    }

    this.setProcessing(false);
    this.renderVideoList();
  }

  async packSelected() {
    const selectedVideos = this.videos.filter(v => this.selectedVideos.has(v.id));
    if (selectedVideos.length < 2) return;

    this.setProcessing(true, 'packaging');

    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.PACK_VIDEOS,
        payload: {
          videos: selectedVideos.map(v => ({
            url: v.url,
            title: v.title
          })),
          format: 'zip'
        }
      });

      if (response.success) {
        selectedVideos.forEach(v => this.updateVideoStatus(v.id, VIDEO_STATUS.COMPLETED));
      } else {
        throw new Error(response.error);
      }

    } catch (error) {
      console.error('Pack error:', error);
      selectedVideos.forEach(v => this.updateVideoStatus(v.id, VIDEO_STATUS.ERROR, error.message));
    }

    this.setProcessing(false);
    this.renderVideoList();
  }

  async retryDownload(videoId) {
    const video = this.videos.find(v => v.id === videoId);
    if (!video) return;

    this.updateVideoStatus(videoId, VIDEO_STATUS.DOWNLOADING);

    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.DOWNLOAD_VIDEO,
        payload: { video }
      });

      if (response.success) {
        this.updateVideoStatus(videoId, VIDEO_STATUS.COMPLETED);
      } else {
        throw new Error(response.error);
      }

    } catch (error) {
      console.error('Retry error:', error);
      this.updateVideoStatus(videoId, VIDEO_STATUS.ERROR, error.message);
    }

    this.renderVideoList();
  }

  updateVideoStatus(videoId, status, error = null) {
    const video = this.videos.find(v => v.id === videoId);
    if (video) {
      video.status = status;
      video.error = error;
    }
  }

  setProcessing(isProcessing, type = 'processing') {
    this.isProcessing = isProcessing;
    this.elements.scanBtn.disabled = isProcessing;
    this.elements.selectAllBtn.disabled = this.videos.length === 0 || isProcessing;
    this.elements.downloadBtn.disabled = isProcessing;
    this.elements.convertBtn.disabled = isProcessing || !this.ffmpegReady;
    this.elements.packBtn.disabled = isProcessing;

    if (isProcessing) {
      this.elements.progressSection.classList.remove('hidden');
      const labels = {
        downloading: chrome.i18n.getMessage('downloading') || '正在下载...',
        processing: chrome.i18n.getMessage('processing') || '正在处理...',
        packaging: chrome.i18n.getMessage('packaging') || '正在打包...'
      };
      this.elements.progressLabel.textContent = labels[type] || labels.processing;
    } else {
      this.elements.progressSection.classList.add('hidden');
    }
  }

  updateProgress(progress, detail = '') {
    this.currentProgress = progress;
    this.elements.progressPercent.textContent = `${progress}%`;
    this.elements.progressFill.style.width = `${progress}%`;
    if (detail) {
      this.elements.progressDetail.textContent = detail;
    }
  }

  showFormatModal() {
    this.elements.formatModal.classList.remove('hidden');
  }

  hideFormatModal() {
    this.elements.formatModal.classList.add('hidden');
  }

  handleBackgroundMessage(message) {
    const { type, payload } = message;

    switch (type) {
      case MESSAGE_TYPES.DOWNLOAD_PROGRESS:
      case MESSAGE_TYPES.PROCESS_PROGRESS:
      case MESSAGE_TYPES.PACK_PROGRESS:
        this.updateProgress(payload.progress, payload.detail);
        break;

      case MESSAGE_TYPES.STATUS_UPDATE:
        this.updateProgress(payload.progress || 0);
        break;

      case MESSAGE_TYPES.DOWNLOAD_COMPLETE:
      case MESSAGE_TYPES.PROCESS_COMPLETE:
      case MESSAGE_TYPES.PACK_COMPLETE:
        this.setProcessing(false);
        break;

      case MESSAGE_TYPES.FFMPEG_READY:
        this.ffmpegReady = true;
        this.elements.convertBtn.disabled = this.selectedVideos.size === 0;
        break;

      case MESSAGE_TYPES.FFMPEG_ERROR:
        console.error('FFmpeg error:', payload.error);
        break;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupApp();
});
