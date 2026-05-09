import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { CHUNK_SIZE, DEFAULT_OUTPUT_FORMAT, SUPPORTED_OUTPUT_FORMATS } from '../shared/constants.js';

export class FFmpegManager {
  constructor() {
    this.ffmpeg = null;
    this.loaded = false;
    this.loading = false;
  }

  async load() {
    if (this.loaded) return;
    if (this.loading) {
      return new Promise((resolve) => {
        const checkLoaded = setInterval(() => {
          if (this.loaded) {
            clearInterval(checkLoaded);
            resolve();
          }
        }, 100);
      });
    }

    this.loading = true;

    try {
      this.ffmpeg = new FFmpeg();

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.loaded = true;
      console.log('FFmpeg loaded successfully');
      return true;

    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async convertVideo(inputData, outputFormat = DEFAULT_OUTPUT_FORMAT, onProgress) {
    if (!this.loaded) {
      await this.load();
    }

    const inputName = `input_${Date.now()}.mp4`;
    const outputName = `output_${Date.now()}.${outputFormat}`;

    try {
      if (onProgress) {
        this.ffmpeg.on('progress', ({ progress }) => {
          onProgress(Math.round(progress * 100));
        });
      }

      let inputBuffer;
      if (typeof inputData === 'string') {
        inputBuffer = await fetchFile(inputData);
      } else if (inputData instanceof Blob) {
        inputBuffer = await fetchFile(inputData);
      } else {
        throw new Error('Invalid input data type');
      }

      await this.ffmpeg.writeFile(inputName, inputBuffer);

      const args = ['-i', inputName];

      if (outputFormat === 'mp4') {
        args.push('-c:v', 'libx264', '-c:a', 'aac', '-preset', 'fast');
      } else if (outputFormat === 'webm') {
        args.push('-c:v', 'libvpx-vp9', '-c:a', 'libopus');
      }

      args.push('-y', outputName);

      await this.ffmpeg.exec(args);

      const data = await this.ffmpeg.readFile(outputName);

      const mimeType = outputFormat === 'mp4' ? 'video/mp4' : 'video/webm';
      const blob = new Blob([data.buffer], { type: mimeType });

      await this.ffmpeg.deleteFile(inputName);
      await this.ffmpeg.deleteFile(outputName);

      return {
        blob,
        name: outputName,
        type: mimeType,
        size: blob.size
      };

    } catch (error) {
      console.error('Video conversion error:', error);
      throw error;
    }
  }

  async mergeVideos(videoList, outputName = 'merged.mp4', onProgress) {
    if (!this.loaded) {
      await this.load();
    }

    if (!videoList || videoList.length === 0) {
      throw new Error('No videos to merge');
    }

    const tempDir = `temp_${Date.now()}`;

    try {
      if (onProgress) {
        this.ffmpeg.on('progress', ({ progress }) => {
          onProgress(Math.round(progress * 100));
        });
      }

      const inputArgs = [];

      for (let i = 0; i < videoList.length; i++) {
        const video = videoList[i];
        const inputName = `${tempDir}_input_${i}.mp4`;

        let inputBuffer;
        if (typeof video === 'string') {
          inputBuffer = await fetchFile(video);
        } else if (video instanceof Blob) {
          inputBuffer = await fetchFile(video);
        } else {
          throw new Error(`Invalid video data at index ${i}`);
        }

        await this.ffmpeg.writeFile(inputName, inputBuffer);
        inputArgs.push('-i', inputName);
      }

      const concatList = videoList.map((_, i) => ({
        file: `${tempDir}_input_${i}.mp4`
      }));

      const listContent = concatList.map(f => `file '${f.file}'`).join('\n');
      const listFile = `${tempDir}_list.txt`;
      await this.ffmpeg.writeFile(listFile, listContent);

      const outputArgs = [
        ...inputArgs,
        '-f', 'concat',
        '-safe', '0',
        '-i', listFile,
        '-c', 'copy',
        '-y', outputName
      ];

      await this.ffmpeg.exec(outputArgs);

      const data = await this.ffmpeg.readFile(outputName);
      const blob = new Blob([data.buffer], { type: 'video/mp4' });

      for (let i = 0; i < videoList.length; i++) {
        await this.ffmpeg.deleteFile(`${tempDir}_input_${i}.mp4`);
      }
      await this.ffmpeg.deleteFile(listFile);
      await this.ffmpeg.deleteFile(outputName);

      return {
        blob,
        name: outputName,
        type: 'video/mp4',
        size: blob.size
      };

    } catch (error) {
      console.error('Video merge error:', error);
      throw error;
    }
  }

  async extractAudio(videoUrl, audioFormat = 'mp3', onProgress) {
    if (!this.loaded) {
      await this.load();
    }

    const inputName = `input_${Date.now()}.mp4`;
    const outputName = `output_${Date.now()}.${audioFormat}`;

    try {
      if (onProgress) {
        this.ffmpeg.on('progress', ({ progress }) => {
          onProgress(Math.round(progress * 100));
        });
      }

      const inputBuffer = await fetchFile(videoUrl);
      await this.ffmpeg.writeFile(inputName, inputBuffer);

      const args = ['-i', inputName];

      if (audioFormat === 'mp3') {
        args.push('-vn', '-acodec', 'libmp3lame', '-q:a', '2');
      } else if (audioFormat === 'aac') {
        args.push('-vn', '-acodec', 'aac');
      } else if (audioFormat === 'wav') {
        args.push('-vn', '-acodec', 'pcm_s16le');
      }

      args.push('-y', outputName);

      await this.ffmpeg.exec(args);

      const data = await this.ffmpeg.readFile(outputName);

      const mimeTypes = {
        mp3: 'audio/mpeg',
        aac: 'audio/aac',
        wav: 'audio/wav'
      };

      const blob = new Blob([data.buffer], {
        type: mimeTypes[audioFormat] || 'audio/mpeg'
      });

      await this.ffmpeg.deleteFile(inputName);
      await this.ffmpeg.deleteFile(outputName);

      return {
        blob,
        name: outputName,
        type: mimeTypes[audioFormat] || 'audio/mpeg',
        size: blob.size
      };

    } catch (error) {
      console.error('Audio extraction error:', error);
      throw error;
    }
  }

  async getVideoInfo(videoUrl) {
    if (!this.loaded) {
      await this.load();
    }

    const inputName = `probe_${Date.now()}.mp4`;

    try {
      const inputBuffer = await fetchFile(videoUrl);
      await this.ffmpeg.writeFile(inputName, inputBuffer);

      let info = {
        duration: 0,
        width: 0,
        height: 0,
        bitrate: 0
      };

      this.ffmpeg.on('log', ({ message }) => {
        const durationMatch = message.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseInt(durationMatch[3]);
          info.duration = hours * 3600 + minutes * 60 + seconds;
        }

        const videoMatch = message.match(/Video:.*?(\d+)x(\d+)/);
        if (videoMatch) {
          info.width = parseInt(videoMatch[1]);
          info.height = parseInt(videoMatch[2]);
        }
      });

      await this.ffmpeg.exec(['-i', inputName]);

      await this.ffmpeg.deleteFile(inputName);

      return info;

    } catch (error) {
      console.error('Video probe error:', error);
      throw error;
    }
  }

  terminate() {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
      this.ffmpeg = null;
      this.loaded = false;
    }
  }
}
