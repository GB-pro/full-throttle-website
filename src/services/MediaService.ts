export class MediaService {
  private static mediaRecorder: MediaRecorder | null = null;
  private static isCancelled = false; 

  // 画像読み込み
  static async loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // 動画読み込み
  static async loadVideo(file: File): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      video.onloadeddata = () => resolve(video);
      video.onerror = reject;
      video.src = URL.createObjectURL(file);
      video.load();
    });
  }

  // 【修正】軽量化と互換性向上
  static async recordAndGetBlob(
    canvas: HTMLCanvasElement, 
    audioStream: MediaStream | null, 
    durationMs: number
  ): Promise<{ blob: Blob, extension: string, mimeType: string } | null> {
    
    this.isCancelled = false;

    return new Promise((resolve) => {
      // 【軽量化】60fps -> 30fps に変更
      // スマホでは60fpsの録画は負荷が高すぎて止まります
      const stream = canvas.captureStream(30);
      
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => stream.addTrack(track));
      }

      // MIMEタイプの決定ロジックを修正
      // 具体的なコーデック指定(codecs=...)は失敗の原因になりやすいため、
      // スマホではシンプルな指定を優先します。
      let mimeType = '';
      let extension = '';

      // iOS Safari (MP4優先)
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
        extension = 'mp4';
      } 
      // Android / Chrome (WebM優先)
      else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
        extension = 'webm';
      } 
      else {
        // フォールバック
        mimeType = ''; // ブラウザのデフォルトに任せる
        extension = 'webm';
      }

      console.log(`Trying MIME: ${mimeType || 'default'}`);

      try {
        const options: MediaRecorderOptions = {
          videoBitsPerSecond: 2500000 // 【軽量化】2.5Mbpsに制限 (画質と軽さのバランス)
        };
        if (mimeType) {
          options.mimeType = mimeType;
        }

        this.mediaRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        console.warn("MediaRecorder init failed with options, trying default.");
        this.mediaRecorder = new MediaRecorder(stream);
        extension = 'webm'; // デフォルトは大抵webm
      }

      // 実際に使われたMIMEタイプを取得（重要）
      const finalMimeType = this.mediaRecorder.mimeType;
      console.log(`Final MIME: ${finalMimeType}`);
      
      // mimeTypeから拡張子を推測しなおす
      if (finalMimeType.includes('mp4')) {
        extension = 'mp4';
      } else {
        extension = 'webm';
      }

      const chunks: Blob[] = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        if (this.isCancelled) {
          this.mediaRecorder = null;
          resolve(null);
          return;
        }

        const blob = new Blob(chunks, { type: finalMimeType });
        this.mediaRecorder = null;
        
        resolve({ blob, extension, mimeType: finalMimeType });
      };

      this.mediaRecorder.start();

      setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
        }
      }, durationMs);
    });
  }

  static cancelRecording() {
    this.isCancelled = true;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }
}