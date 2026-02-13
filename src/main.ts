import './style.css';
import { MediaService } from './services/MediaService';
import { CanvasLogic, type LayoutId } from './logics/CanvasLogic';
import { AudioService } from './services/AudioService';

// --- UI要素 (DOM取得) ---
const introScreen = document.getElementById('introScreen') as HTMLDivElement;
const appScreen = document.getElementById('appScreen') as HTMLDivElement;
const titleWrapper = document.getElementById('titleWrapper') as HTMLDivElement;
const titleImage = document.getElementById('titleImage') as HTMLImageElement;
const introStartBtn = document.getElementById('introStartBtn') as HTMLButtonElement;
const introStartBtn2 = document.getElementById('introStartBtn2') as HTMLButtonElement;
const customFileBtn = document.getElementById('customFileBtn') as HTMLButtonElement;
const fileSubText = document.getElementById('fileSubText') as HTMLParagraphElement;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const inputSection = document.getElementById('inputSection') as HTMLDivElement;

const textInputA = document.getElementById('textInputA') as HTMLInputElement;
const textInputB = document.getElementById('textInputB') as HTMLInputElement;

const textDecideBtn = document.getElementById('textDecideBtn') as HTMLButtonElement;
const mainPlayBtn = document.getElementById('mainPlayBtn') as HTMLButtonElement;
const canvas = document.getElementById('mainCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const backBtn = document.getElementById('backBtn') as HTMLButtonElement;
const shareBtn = document.getElementById('shareBtn') as HTMLButtonElement;
const recordingModal = document.getElementById('recordingModal') as HTMLDivElement;
const recordingStatus = document.getElementById('recordingStatus') as HTMLDivElement;
const cancelBtn = document.getElementById('cancelBtn') as HTMLButtonElement;

// --- 状態管理 ---
let currentSource: HTMLImageElement | HTMLVideoElement | null = null;
let isVideo = false;
let isPlaying = false; 
let isRecording = false; 
let lastAudioTime = 0;
let elapsedTime = 0;
let lastTimestamp = 0;

// ★変更箇所: パターン4と7を削除しました
const layoutIds: LayoutId[] = [0, 1, 2, 3, 5, 6, 8, 9, 10, 11, 12, 13];

let currentLayoutId: LayoutId = 0;
let recentLayouts: LayoutId[] = [0]; 
const layoutChangeInterval = 3417; // 1サイクルの長さ
let displayText = ""; 
let shrinkStartIndex = -1;

// A/B用のベーステキスト
let baseTextA = "";
let baseTextB = "";

let baseExtendCharB = "";     
let extendCountB = 0;         
let currentShareText = "";

const presetTexts = [
  "ゴァッ", "コッファ", "ドンッ", "ズザザザ", "セリコォォ", 
  "ゾワワ", "ドガガ", "ズンッ", "ゴァァ", "ゴァオ", "ゴォァァ", 
  "アァァ", "ガンッ", "ドァァ", "モツゥゥ", "ジャァァ"
];
let currentPresetText = "";
const config = {
  fontSizeRatio: 5, 
  shakeIntensity: 3,
  shakeSpeed: 0.15,
};

AudioService.init('/audio/TP14sec.mp3'); 

// --- ヘルパー関数 ---
function updateTitle(imagePath: string) {
  titleImage.src = imagePath;
}

// B用の変異ロジック (Aには適用しない)
function rebuildScreamTextB(): string {
  if (!baseTextB) return "";

  const extChars = new Array(extendCountB).fill(baseExtendCharB);

  if (extendCountB >= 5 && Math.random() < 0.33) {
      let targetChar = baseExtendCharB;
      switch (baseExtendCharB) {
          case 'ァ': targetChar = ['ェ', 'ォ', 'ィ'][Math.floor(Math.random() * 3)]; break;
          case 'ィ': targetChar = 'ァ'; break;
          case 'ゥ': targetChar = ['ァ', 'ォ'][Math.floor(Math.random() * 2)]; break;
          case 'ェ': targetChar = ['ァ', 'ォ'][Math.floor(Math.random() * 2)]; break;
          case 'ォ': targetChar = ['ァ', 'ェ'][Math.floor(Math.random() * 2)]; break;
      }
      extChars[4] = targetChar;
  }

  return baseTextB + extChars.join('');
}

function initScreamTexts(inputA: string, inputB: string) {
  // Aはそのまま保持
  baseTextA = inputA;

  // Bは変異計算用の準備
  const lastChar = inputB.slice(-1);
  let extendChar = '';

  const vowels: { [key: string]: string } = {
    'あかさたなはまやらわがざだばぱゃぁアカサタナハマヤラワガザダバパャァ': 'ァ',
    'いきしちにひみりぎじぢびぴぃイキシチニヒミリギジヂビピィ': 'ィ',
    'うくすつぬふむゆるぐずづぶぷゅぅっウクスツヌフムユルグズヅブプュゥッヴ': 'ゥ',
    'えけせてねへめれげぜでべぺぇエケセテネヘメレゲゼデベペェ': 'ェ',
    'おこそとのほもよろをごぞどぼぽょぉオコソトノホモヨロヲゴゾドボポョォ': 'ォ',
    'んン': 'ン'
  };

  for (const [keys, val] of Object.entries(vowels)) {
    if (keys.includes(lastChar)) { extendChar = val; break; }
  }
  if (!extendChar) extendChar = 'ッ';

  const count = Math.floor(Math.random() * 4) + 5;

  baseTextB = inputB;
  baseExtendCharB = extendChar;
  extendCountB = count;
  
  // 初期表示用に一旦計算
  displayText = baseTextA;
}

// サイクル管理用変数
let lastPhase = -1; // 0: A, 1: B, 2: Break

function animationLoop(timestamp: number) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const deltaTime = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  if (!currentSource || !isPlaying) {
    requestAnimationFrame(animationLoop);
    return;
  }

  try {
    elapsedTime += deltaTime;
    const audioTime = AudioService.getCurrentTime();
    const audioDuration = AudioService.getDuration();

    if (isVideo && currentSource instanceof HTMLVideoElement) {
      if (audioTime < lastAudioTime || (audioDuration > 0 && audioTime >= audioDuration)) {
        currentSource.currentTime = 0;
      }
    }
    lastAudioTime = audioTime;

    // --- サイクル制御 (A -> B -> Break) ---
    const cycleProgress = (elapsedTime % layoutChangeInterval) / layoutChangeInterval;
    let currentPhase = 0;

    if (cycleProgress < 0.45) {
      currentPhase = 0; // A: Normal
    } else if (cycleProgress < 0.90) {
      currentPhase = 1; // B: Scream
    } else {
      currentPhase = 2; // Break: Blank
    }

    if (currentPhase !== lastPhase) {
      if (currentPhase !== 2) {
        const candidates = layoutIds.filter(id => !recentLayouts.includes(id));
        const nextId = candidates[Math.floor(Math.random() * candidates.length)];
        currentLayoutId = nextId;
        recentLayouts.push(nextId);
        if (recentLayouts.length > 2) recentLayouts.shift();
      }

      if (currentPhase === 0) {
        // A表示
        displayText = baseTextA;
        shrinkStartIndex = -1; 
        currentPresetText = ""; 
      } else if (currentPhase === 1) {
        // B表示
        displayText = rebuildScreamTextB();
        shrinkStartIndex = baseTextB.length; 
        
        if (Math.random() < 0.5) {
            currentPresetText = presetTexts[Math.floor(Math.random() * presetTexts.length)];
        } else {
            currentPresetText = ""; 
        }
      } else {
        // Break
        displayText = "";
        currentPresetText = "";
      }
      lastPhase = currentPhase;
    }
    
    CanvasLogic.draw(ctx, currentSource, displayText, elapsedTime, config, currentLayoutId, shrinkStartIndex, currentPresetText);

  } catch (e) {
    console.error("Animation Error:", e);
  }
  requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

// --- 画面遷移とロジック ---
async function startApp() {
  if (!currentSource) return;

  introScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');

  elapsedTime = 0;
  lastPhase = -1;
  CanvasLogic.resetEffects();
  recentLayouts = [0];
  currentLayoutId = 0;
  currentPresetText = "";

  displayText = baseTextA;

  await AudioService.resumeContext();
  AudioService.play();
  if (isVideo && currentSource instanceof HTMLVideoElement) {
    currentSource.play().catch(e => console.error("Video play error:", e));
  }

  isPlaying = true;
}

function goBack() {
  isPlaying = false;
  AudioService.stopAndReset();
  if (isVideo && currentSource instanceof HTMLVideoElement) {
    currentSource.pause();
    currentSource.currentTime = 0;
  }
  
  introScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
  
  mainPlayBtn.classList.add('hidden');
  
  inputSection.classList.remove('hidden');
  customFileBtn.classList.remove('hidden');
  fileSubText.classList.remove('hidden');
  
  introStartBtn.classList.add('hidden');
  introStartBtn2.classList.add('hidden');

  updateTitle('/images/FullThrottle.png');
  titleWrapper.classList.remove('blink-fast');
}

// --- イベントリスナー ---
function showInputScreen() {
  introStartBtn.classList.add('hidden');
  introStartBtn2.classList.add('hidden');
  const instText = document.querySelector('.instruction-text');
  if(instText) instText.classList.remove('hidden');

  customFileBtn.classList.remove('hidden');
  fileSubText.classList.remove('hidden');
  AudioService.resumeContext();
}

introStartBtn.addEventListener('click', () => {
  AudioService.setSrc('/audio/TP14sec.mp3');
  // ★修正箇所: シェア用文言を更新
  currentShareText = '#タイパー大喜利 大会開催中！！　 #TimelessPower #MFゴースト #FullThrottle #フルスロ';
  showInputScreen();
});

customFileBtn.addEventListener('click', () => {
  fileInput.value = ''; 
  fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  if (file.type.startsWith('video/')) {
    isVideo = true;
    const video = await MediaService.loadVideo(file);
    video.pause();
    video.currentTime = 0;
    currentSource = video;
  } else {
    isVideo = false;
    currentSource = await MediaService.loadImage(file);
  }

  inputSection.classList.remove('hidden');
  textInputA.focus(); 
});

const confirmText = () => {
  const valA = textInputA.value;
  const valB = textInputB.value;

  if (valA.length > 0 && valB.length > 0) {
    
    const hasKanjiA = /[\u4E00-\u9FFF]/.test(valA);
    const hasKanjiB = /[\u4E00-\u9FFF]/.test(valB);
    
    if (hasKanjiA || hasKanjiB) {
      alert(
        "INVALID CHARACTERS DETECTED.\n" + 
        "NO KANJI ALLOWED."
      );
      return; 
    }

    initScreamTexts(valA, valB);

    updateTitle('/images/LetsGo.png');
    
    titleWrapper.classList.add('blink-fast');
    mainPlayBtn.classList.remove('hidden');
    
    textInputA.blur();
    textInputB.blur();
  } else {
    alert("Please input both A and B text.");
  }
};

textDecideBtn.addEventListener('click', confirmText);
textInputA.addEventListener('keypress', (e) => { if (e.key === 'Enter') confirmText(); });
textInputB.addEventListener('keypress', (e) => { if (e.key === 'Enter') confirmText(); });

mainPlayBtn.addEventListener('click', startApp);
titleWrapper.addEventListener('click', () => {
  if (!mainPlayBtn.classList.contains('hidden')) {
    startApp();
  }
});

backBtn.addEventListener('click', goBack);

shareBtn.addEventListener('click', () => {
  startRecordingProcess('share');
});

cancelBtn.addEventListener('click', () => {
  if (isRecording) {
    MediaService.cancelRecording();
    closeModal();
    isRecording = false;
    startPlayback();
    alert("RECORDING ABORTED.");
  }
});

function openModal() {
  recordingModal.classList.add('active');
  const progressBar = recordingModal.querySelector('.loading-progress') as HTMLDivElement;
  if (progressBar) {
    progressBar.style.width = '0%';
    progressBar.style.transition = 'none';
  }
}

function closeModal() {
  recordingModal.classList.remove('active');
}

function startPlayback() {
  if (!currentSource) return;
  isPlaying = true;
  AudioService.play();
  if (isVideo && currentSource instanceof HTMLVideoElement) {
    currentSource.play();
  }
}

function pausePlayback() {
  isPlaying = false;
  AudioService.pause();
  if (isVideo && currentSource instanceof HTMLVideoElement) {
    currentSource.pause();
  }
}

async function startRecordingProcess(mode: 'share') {
  if (!currentSource) return;

  AudioService.stopAndReset();
  if (isVideo && currentSource instanceof HTMLVideoElement) {
    currentSource.currentTime = 0;
  }

  elapsedTime = 0;
  lastPhase = -1;
  CanvasLogic.resetEffects();
  recentLayouts = [0];
  currentLayoutId = 0;
  
  displayText = baseTextA;

  isRecording = true;
  isPlaying = true;
  openModal();
  
  const modalContent = recordingModal.querySelector('.modal-content')!;
  
  const oldBtns = modalContent.querySelectorAll('.result-action-btn');
  oldBtns.forEach(btn => btn.remove());
  
  recordingStatus.textContent = "RECORDING...";
  cancelBtn.style.display = 'inline-block';

  try {
    await AudioService.resumeContext();
    AudioService.play();
    if (isVideo && currentSource instanceof HTMLVideoElement) {
      currentSource.play().catch(e => console.error("Video play error:", e));
    }

    const duration = AudioService.getDuration();
    const recordDurationMs = (isFinite(duration) && duration > 0) ? duration * 1000 : 5000;

    const progressBar = recordingModal.querySelector('.loading-progress') as HTMLDivElement;
    if (progressBar) {
      requestAnimationFrame(() => {
         progressBar.style.transition = `width ${recordDurationMs}ms linear`;
         progressBar.style.width = '100%';
      });
    }

    const generatingTimer = setTimeout(() => {
      if(isRecording) recordingStatus.textContent = "GENERATING VIDEO...";
    }, recordDurationMs);

    const audioTrack = AudioService.getStream();
    const audioStream = audioTrack ? new MediaStream([audioTrack]) : null;

    const result = await MediaService.recordAndGetBlob(
      canvas, 
      audioStream, 
      recordDurationMs
    );

    clearTimeout(generatingTimer);
    
    isRecording = false;
    pausePlayback();

    if (!result || !result.blob) {
      closeModal();
      return;
    }

    const { blob, mimeType } = result;
    const fileName = `full_throttle_${Date.now()}.mp4`;
    
    if (blob.size === 0) {
      alert("ERROR: EMPTY DATA.");
      closeModal();
      return;
    }

    if (mode === 'share') {
      recordingStatus.textContent = "VIDEO READY.";
      cancelBtn.style.display = 'none';

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      const createBtn = (text: string) => {
        const btn = document.createElement('button');
        btn.className = 'result-action-btn'; 
        btn.textContent = text;
        return btn;
      };

      const file = new File([blob], fileName, { type: mimeType });
      const canShare = (navigator as any).share && (navigator as any).canShare && (navigator as any).canShare({ files: [file] });

      if (!isMobile || !canShare) {
        const saveBtn = createBtn("SAVE VIDEO");
        saveBtn.onclick = async () => {
           if ('showSaveFilePicker' in window) {
             try {
               const handle = await (window as any).showSaveFilePicker({
                 suggestedName: fileName,
                 types: [{ description: 'Video File', accept: { 'video/mp4': ['.mp4'] } }],
               });
               const writable = await handle.createWritable();
               await writable.write(blob);
               await writable.close();
               alert("SAVED.");
               closeModal();
               return;
             } catch (err: any) {
               if (err.name === 'AbortError') return;
             }
           }
           
           const url = URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = fileName;
           document.body.appendChild(a);
           a.click();
           document.body.removeChild(a);
           URL.revokeObjectURL(url);
           
           setTimeout(() => {
             alert("SAVED TO DOWNLOADS.");
           }, 500);
           
           closeModal();
        };
        modalContent.appendChild(saveBtn);
      }

      if (canShare) {
        const shareBtn = createBtn("SHARE");
        shareBtn.onclick = async () => {
           try {
            await navigator.share({
              files: [file],
              title: 'Full Throttle',
              text: currentShareText, 
            });
          } catch (err: any) {
            if (err.name !== 'AbortError') {
               alert("SHARE FAILED. TRY SAVING INSTEAD.");
            }
          }
          closeModal();
        };
        modalContent.appendChild(shareBtn);
      }
    }

  } catch (err) {
    console.error("Recording failed:", err);
    closeModal();
    isRecording = false;
    pausePlayback();
    alert("SYSTEM ERROR.");
  }
}