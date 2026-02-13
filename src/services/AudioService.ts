export class AudioService {
  private static bgm: HTMLAudioElement | null = null;
  private static audioCtx: AudioContext | null = null;
  private static dest: MediaStreamAudioDestinationNode | null = null;

  static init(url: string) {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioContext();

    this.bgm = new Audio();
    this.bgm.crossOrigin = "anonymous";
    this.bgm.src = url;
    this.bgm.loop = true;
    this.bgm.volume = 0.5;

    const source = this.audioCtx.createMediaElementSource(this.bgm);
    this.dest = this.audioCtx.createMediaStreamDestination();
    
    source.connect(this.dest);
    source.connect(this.audioCtx.destination);
  }

  // ★このメソッドがないとエラーになります
  static setSrc(url: string) {
    if (this.bgm) {
      this.bgm.src = url;
      // 読み込み直して準備
      this.bgm.load();
    }
  }

  static async resumeContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  static play() {
    this.resumeContext(); 
    const playPromise = this.bgm?.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => console.log("Play blocked:", e));
    }
  }

  static pause() {
    this.bgm?.pause();
  }
  
  static stopAndReset() {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.currentTime = 0;
    }
  }

  static getCurrentTime(): number {
    return this.bgm ? this.bgm.currentTime : 0;
  }

  static getDuration(): number {
    return this.bgm ? this.bgm.duration : 0;
  }

  static getStream(): MediaStreamTrack | null {
    return this.dest ? this.dest.stream.getAudioTracks()[0] : null;
  }
}