import { VIDEO_MIME_TYPES, VIDEO_EXTENSIONS, VIDEO_STATUS } from '../shared/constants.js';
import { generateId, extractVideoInfo, debounce } from '../shared/utils.js';
import { MESSAGE_TYPES } from '../shared/constants.js';

class VideoScanner {
  constructor() {
    this.scannedVideos = new Map();
    this.observer = null;
    this.isScanning = false;
    this.init();
  }

  init() {
    this.setupMessageListener();
    this.setupMutationObserver();
    this.scanExistingVideos();
  }

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === MESSAGE_TYPES.SCAN_VIDEOS) {
        this.handleScanRequest(event.data.payload);
      }
    });
  }

  setupMutationObserver() {
    this.observer = new MutationObserver(debounce((mutations) => {
      let hasNewVideos = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (this.isVideoElement(node) || this.containsVideoElement(node)) {
              hasNewVideos = true;
              break;
            }
          }
        }
        if (hasNewVideos) break;
      }

      if (hasNewVideos) {
        this.scanForNewVideos();
      }
    }, 300));

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  scanExistingVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => this.processVideoElement(video));

    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => this.scanIframe(iframe));
  }

  scanForNewVideos() {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        const url = video.src || video.currentSrc;
        if (url && !this.scannedVideos.has(url)) {
          this.processVideoElement(video);
        }
      });
    } finally {
      this.isScanning = false;
    }
  }

  processVideoElement(video) {
    const url = video.src || video.currentSrc;

    if (!url || url === '' || url === window.location.href) {
      return null;
    }

    if (this.scannedVideos.has(url)) {
      return this.scannedVideos.get(url);
    }

    const videoInfo = this.extractVideoDetails(video);
    this.scannedVideos.set(url, videoInfo);

    return videoInfo;
  }

  extractVideoDetails(video) {
    const url = video.src || video.currentSrc;

    const title = this.extractTitle(video);
    const duration = video.duration || 0;
    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;
    const type = this.getMimeType(video, url);

    let size = 0;
    if (video.getAttribute('data-size')) {
      size = parseInt(video.getAttribute('data-size'), 10);
    } else if (video.readyState >= 1) {
      size = this.estimateVideoSize(video);
    }

    const thumbnail = this.generateThumbnail(video);

    const id = generateId();

    return {
      id,
      url,
      title,
      duration,
      width,
      height,
      type,
      size,
      thumbnail,
      status: VIDEO_STATUS.DETECTED,
      pageUrl: window.location.href,
      pageTitle: document.title
    };
  }

  extractTitle(video) {
    const selectors = [
      'h1', 'h2', 'h3',
      '.video-title', '.title', '[class*="title"]',
      '.player-title', '[class*="player"] h1, [class*="player"] h2',
      'meta[property="og:title"]',
      'meta[name="title"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = selector.startsWith('meta')
          ? el.getAttribute('content')
          : el.textContent;
        if (text && text.trim()) {
          return text.trim().substring(0, 100);
        }
      }
    }

    const pageTitle = document.title.split(/[|\-–—]/)[0].trim();
    if (pageTitle) {
      return pageTitle.substring(0, 100);
    }

    return `Video_${Date.now()}`;
  }

  getMimeType(video, url) {
    if (video.canPlayType) {
      const types = ['video/mp4', 'video/webm', 'video/ogg'];
      for (const type of types) {
        if (video.canPlayType(type)) {
          return type;
        }
      }
    }

    const ext = url.split('.').pop().split('?')[0].toLowerCase();
    const mimeMap = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      ogg: 'video/ogg',
      ogv: 'video/ogg',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      m4v: 'video/x-m4v'
    };

    return mimeMap[ext] || 'video/mp4';
  }

  estimateVideoSize(video) {
    if (video.duration && video.videoWidth && video.videoHeight) {
      const bitrateEstimate = 5000000;
      const sizeEstimate = (video.duration * bitrateEstimate) / 8;
      return Math.round(sizeEstimate);
    }
    return 0;
  }

  generateThumbnail(video) {
    try {
      if (video.readyState >= 2) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const maxSize = 160;
        const aspectRatio = video.videoWidth / video.videoHeight;

        if (aspectRatio > 1) {
          canvas.width = maxSize;
          canvas.height = Math.round(maxSize / aspectRatio);
        } else {
          canvas.height = maxSize;
          canvas.width = Math.round(maxSize * aspectRatio);
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        return dataUrl;
      }
    } catch (error) {
      console.warn('Failed to generate thumbnail:', error);
    }

    return '';
  }

  async scanIframe(iframe) {
    try {
      if (iframe.src && !iframe.src.startsWith('about:')) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const videos = iframeDoc.querySelectorAll('video');
          videos.forEach(video => this.processVideoElement(video));
        }
    } catch (error) {
      // Cross-origin iframe, cannot access
    }
  }

  scanNetworkRequests() {
    const originalFetch = window.fetch;
    const originalXHR = window.XMLHttpRequest;

    window.fetch = async (...args) => {
      const response = await originalFetch.apply(window, args);
      this.checkForVideoUrl(args[0]?.url || args[0]);
      return response;
    };

    window.XMLHttpRequest = class extends originalXHR {
      open(method, url, ...rest) {
        this._url = url;
        return super.open(method, url, ...rest);
      }

      send(...args) {
        this.addEventListener('load', () => {
          this.checkForVideoUrl(this._url);
        });
        return super.send(...args);
      }

      checkForVideoUrl(url) {
        if (url && VideoScanner.isVideoUrl(url)) {
          console.log('Video URL detected:', url);
        }
      }
    };
  }

  static isVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;

    try {
      const urlLower = url.toLowerCase();
      const isExtension = VIDEO_EXTENSIONS.some(ext => urlLower.includes(ext));
      const isMimeType = VIDEO_MIME_TYPES.some(type => url.includes(type));

      return isExtension || isMimeType;
    } catch (error) {
      return false;
    }
  }

  isVideoElement(node) {
    return node && node.nodeName === 'VIDEO';
  }

  containsVideoElement(node) {
    if (!node || !node.querySelectorAll) return false;
    return node.querySelectorAll('video').length > 0;
  }

  async handleScanRequest(payload) {
    try {
      this.scanExistingVideos();

      const videos = Array.from(this.scannedVideos.values());

      return {
        type: MESSAGE_TYPES.SCAN_RESULT,
        payload: {
          success: true,
          videos,
          count: videos.length,
          pageUrl: window.location.href
        }
      };

    } catch (error) {
      return {
        type: MESSAGE_TYPES.SCAN_RESULT,
        payload: {
          success: false,
          error: error.message,
          videos: [],
          count: 0
        }
      };
    }
  }

  getVideos() {
    return Array.from(this.scannedVideos.values());
  }

  getVideoById(id) {
    for (const video of this.scannedVideos.values()) {
      if (video.id === id) {
        return video;
      }
    }
    return null;
  }

  clearCache() {
    this.scannedVideos.clear();
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

if (typeof window !== 'undefined') {
  window.videoScanner = new VideoScanner();
}
