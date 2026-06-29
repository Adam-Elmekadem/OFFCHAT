import type { PeerInfo } from '@offchat/domain';
import type { SendMessage } from '@offchat/application';
import type { LanTransport } from '@offchat/transport-lan';
import { AudioStream, ffmpegAvailable } from './AudioStream.js';

export type CallState = 'idle' | 'calling' | 'ringing' | 'active';

export interface CallSignal {
  type: 'call-request' | 'call-accept' | 'call-reject' | 'call-end';
  audioPort?: number;
}

export class CallManager {
  private state: CallState = 'idle';
  private remotePeer: PeerInfo | null = null;
  private remoteAudioPort = 0;
  private localAudioPort  = 0;
  private audioStream: AudioStream | null = null;
  private ptt = false;

  private onStateChange?: (state: CallState, peer: PeerInfo | null) => void;
  private onError?: (msg: string) => void;

  constructor(
    private readonly transport: LanTransport,
    private readonly sendMessage: SendMessage,
    private readonly identity: { id: string; privateKey: Uint8Array; signingPrivateKey: Uint8Array; nickname: string },
  ) {}

  setListeners(opts: {
    onStateChange: (state: CallState, peer: PeerInfo | null) => void;
    onError: (msg: string) => void;
  }): void {
    this.onStateChange = opts.onStateChange;
    this.onError       = opts.onError;
  }

  getState(): CallState { return this.state; }

  async initiateCall(peer: PeerInfo): Promise<void> {
    if (this.state !== 'idle') {
      this.onError?.('Already in a call');
      return;
    }
    if (!ffmpegAvailable()) {
      this.onError?.('FFmpeg not found — install FFmpeg and add it to PATH for voice calls');
      return;
    }

    this.remotePeer = peer;
    this.localAudioPort = await this.transport.startAudio(buf => {
      if (this.ptt && this.state === 'active' && this.remotePeer) {
        const ip = this.transport.getPeerAddress(this.remotePeer.deviceId);
        if (ip) this.transport.sendAudio(buf, ip, this.remoteAudioPort);
      }
    });

    await this.sendSignal(peer, { type: 'call-request', audioPort: this.localAudioPort });
    this.setState('calling');
  }

  async handleIncoming(signal: CallSignal, from: PeerInfo): Promise<void> {
    if (signal.type === 'call-request') {
      if (this.state !== 'idle') {
        await this.sendSignal(from, { type: 'call-reject' });
        return;
      }
      this.remotePeer      = from;
      this.remoteAudioPort = signal.audioPort ?? 0;
      this.setState('ringing');
      return;
    }

    if (signal.type === 'call-accept' && this.state === 'calling') {
      this.remoteAudioPort = signal.audioPort ?? 0;
      await this.beginAudio();
      this.setState('active');
      return;
    }

    if (signal.type === 'call-reject' && this.state === 'calling') {
      await this.endCall(false);
      this.onError?.('Call rejected');
      return;
    }

    if (signal.type === 'call-end') {
      await this.endCall(false);
    }
  }

  async acceptCall(): Promise<void> {
    if (this.state !== 'ringing' || !this.remotePeer) return;

    this.localAudioPort = await this.transport.startAudio(buf => {
      if (this.ptt && this.state === 'active' && this.remotePeer) {
        const ip = this.transport.getPeerAddress(this.remotePeer.deviceId);
        if (ip) this.transport.sendAudio(buf, ip, this.remoteAudioPort);
      }
    });

    await this.sendSignal(this.remotePeer, { type: 'call-accept', audioPort: this.localAudioPort });
    await this.beginAudio();
    this.setState('active');
  }

  async rejectCall(): Promise<void> {
    if (this.state !== 'ringing' || !this.remotePeer) return;
    await this.sendSignal(this.remotePeer, { type: 'call-reject' });
    await this.endCall(false);
  }

  async hangup(): Promise<void> {
    if (this.state === 'idle') return;
    if (this.remotePeer) await this.sendSignal(this.remotePeer, { type: 'call-end' });
    await this.endCall(false);
  }

  setPushToTalk(active: boolean): void {
    this.ptt = active;
    if (!active && this.audioStream) {
      this.audioStream.stopCapture();
    } else if (active && this.state === 'active' && this.audioStream) {
      this.audioStream.startCapture(buf => {
        if (this.remotePeer) {
          const ip = this.transport.getPeerAddress(this.remotePeer.deviceId);
          if (ip) this.transport.sendAudio(buf, ip, this.remoteAudioPort);
        }
      });
    }
  }

  private async beginAudio(): Promise<void> {
    this.audioStream = new AudioStream();
    this.audioStream.startPlayback();
    this.transport.startAudio((buf) => {
      this.audioStream?.writeAudio(buf);
    }).catch(() => {});
  }

  private async endCall(sendEnd: boolean): Promise<void> {
    if (sendEnd && this.remotePeer) {
      await this.sendSignal(this.remotePeer, { type: 'call-end' });
    }
    this.audioStream?.stop();
    this.audioStream = null;
    this.transport.stopAudio();
    this.remotePeer      = null;
    this.remoteAudioPort = 0;
    this.localAudioPort  = 0;
    this.ptt = false;
    this.setState('idle');
  }

  private setState(s: CallState): void {
    this.state = s;
    this.onStateChange?.(s, this.remotePeer);
  }

  private async sendSignal(peer: PeerInfo, signal: CallSignal): Promise<void> {
    await this.sendMessage.execute({
      text:              JSON.stringify(signal),
      recipientDeviceId: peer.deviceId,
      recipientPublicKey: peer.publicKey,
      chatScope:         'dm',
      messageType:       'call-signal',
    });
  }
}
