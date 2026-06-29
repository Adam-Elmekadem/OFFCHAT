import { spawn, type ChildProcess } from 'node:child_process';
import { execSync } from 'node:child_process';

export function ffmpegAvailable(): boolean {
  try { execSync('ffmpeg -version', { stdio: 'ignore' }); return true; }
  catch { return false; }
}

export class AudioStream {
  private captureProc: ChildProcess | null = null;
  private playbackProc: ChildProcess | null = null;

  startCapture(onChunk: (buf: Buffer) => void): void {
    // dshow: virtual audio capture through FFmpeg on Windows
    this.captureProc = spawn('ffmpeg', [
      '-f', 'dshow',
      '-i', 'audio=@device_cm_{33D9A762-90C8-11D0-BD43-00A0C911CE86}\\wave_{default}',
      '-acodec', 'pcm_s16le',
      '-ar', '8000',
      '-ac', '1',
      '-f', 'u16le',
      '-',
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    this.captureProc.stdout?.on('data', (chunk: Buffer) => onChunk(chunk));

    this.captureProc.on('error', () => {
      // FFmpeg not found or dshow unavailable — silently stop
      this.stopCapture();
    });
  }

  stopCapture(): void {
    this.captureProc?.kill('SIGTERM');
    this.captureProc = null;
  }

  startPlayback(): void {
    // Play raw PCM from stdin via FFmpeg → default audio output
    this.playbackProc = spawn('ffmpeg', [
      '-f', 'u16le',
      '-ar', '8000',
      '-ac', '1',
      '-i', 'pipe:0',
      '-f', 'dshow',
      '-',
    ], { stdio: ['pipe', 'ignore', 'ignore'] });

    this.playbackProc.on('error', () => this.stopPlayback());
  }

  writeAudio(chunk: Buffer): void {
    this.playbackProc?.stdin?.write(chunk);
  }

  stopPlayback(): void {
    try { this.playbackProc?.stdin?.end(); } catch { /**/ }
    this.playbackProc?.kill('SIGTERM');
    this.playbackProc = null;
  }

  stop(): void {
    this.stopCapture();
    this.stopPlayback();
  }
}
