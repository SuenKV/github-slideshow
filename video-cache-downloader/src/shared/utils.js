export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatFileSize(bytes) {
  if (bytes === 0 || bytes === null || bytes === undefined) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function extractVideoInfo(videoElement) {
  const id = generateId();
  const url = videoElement.src || videoElement.currentSrc || '';
  const title = extractTitle(videoElement);
  const duration = videoElement.duration || 0;
  const type = getMimeType(url, videoElement);
  const size = videoElement.getAttribute('data-size') || 0;

  return {
    id,
    url,
    title,
    duration,
    type,
    size: parseInt(size, 10) || 0,
    status: 'detected'
  };
}

function extractTitle(videoElement) {
  const parent = videoElement.closest('.video-container, .player, [class*="video"], [class*="player"]');
  if (parent) {
    const titleEl = parent.querySelector('h1, h2, h3, .title, [class*="title"]');
    if (titleEl) return titleEl.textContent.trim();
  }

  const pageTitle = document.title;
  if (pageTitle) return pageTitle.substring(0, 50);

  return `Video_${Date.now()}`;
}

function getMimeType(url, videoElement) {
  if (videoElement.canPlayType) {
    const types = ['video/mp4', 'video/webm', 'video/ogg'];
    for (const type of types) {
      if (videoElement.canPlayType(type)) {
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
    mkv: 'video/x-matroska'
  };

  return mimeMap[ext] || 'video/mp4';
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function getCacheStorageInfo() {
  if ('caches' in window) {
    const cache = await caches.open('video-cache-v1');
    const keys = await cache.keys();
    let totalSize = 0;
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
    return { count: keys.length, size: totalSize };
  }
  return { count: 0, size: 0 };
}

export function sanitizeFilename(filename) {
  return filename.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
}

export function createProgressHandler(callback) {
  let lastUpdate = 0;
  return (progress) => {
    const now = Date.now();
    if (now - lastUpdate > 100) {
      callback(progress);
      lastUpdate = now;
    }
  };
}
