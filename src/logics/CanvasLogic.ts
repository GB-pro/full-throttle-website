export type LayoutId = 0 | 1 | 2 | 3 | 5 | 6 | 8 | 9 | 10 | 11 | 12 | 13;

interface LayoutConfig {
  user: {
    xRatio: number; 
    yRatio: number; 
    slope: number;    
    arcDepthRatio: number; 
    align: 'left' | 'center' | 'right'; 
    spacingRatio?: number; 
  };
  preset: {
    xRatio: number;
    yRatio: number;
    angle: number;    
  };
}

const LAYOUTS: Record<LayoutId, LayoutConfig> = {
  0: { user: { xRatio: 0.1, yRatio: 0.5, slope: 0, arcDepthRatio: 0.05, align: 'left' }, preset: { xRatio: 0.45, yRatio: 0.75, angle: 0 } },
  1: { user: { xRatio: 0.1, yRatio: 0.15, slope: 0.6, arcDepthRatio: 0, align: 'left' }, preset: { xRatio: 0.47, yRatio: 0.6, angle: -0.2 } },
  2: { user: { xRatio: 0.1, yRatio: 0.7, slope: -0.6, arcDepthRatio: 0, align: 'left' }, preset: { xRatio: 0.5, yRatio: 0.15, angle: 0.2 } },
  3: { user: { xRatio: 0.5, yRatio: 0.1, slope: 3.5, arcDepthRatio: 0, align: 'center', spacingRatio: 0.4 }, preset: { xRatio: 0.48, yRatio: 0.8, angle: 0 } },
  5: { user: { xRatio: 0.1, yRatio: 0.3, slope: 0.1, arcDepthRatio: 0.35, align: 'left', spacingRatio: 0.57 }, preset: { xRatio: 0.55, yRatio: 0.75, angle: -0.1 } },
  6: { user: { xRatio: 0.1, yRatio: 0.55, slope: -0.4, arcDepthRatio: 0.05, align: 'left' }, preset: { xRatio: 0.48, yRatio: 0.8, angle: 0.1 } },
  8: { user: { xRatio: 0.85, yRatio: 0.25, slope: 0, arcDepthRatio: 0, align: 'right' }, preset: { xRatio: 0.1, yRatio: 0.7, angle: 0 } },
  9: { user: { xRatio: 0.85, yRatio: 0.3, slope: 0, arcDepthRatio: 0, align: 'right' }, preset: { xRatio: 0.1, yRatio: 0.75, angle: 0 } },
  10: { user: { xRatio: 0.85, yRatio: 0.75, slope: 0, arcDepthRatio: 0, align: 'right' }, preset: { xRatio: 0.1, yRatio: 0.2, angle: 0 } },
  11: { user: { xRatio: 0.15, yRatio: 0.25, slope: 0, arcDepthRatio: 0, align: 'left' }, preset: { xRatio: 0.8, yRatio: 0.7, angle: 0 } },
  12: { user: { xRatio: 0.15, yRatio: 0.6, slope: 0, arcDepthRatio: 0, align: 'left' }, preset: { xRatio: 0.8, yRatio: 0.2, angle: 0 } },
  13: { user: { xRatio: 0.15, yRatio: 0.75, slope: 0, arcDepthRatio: 0, align: 'left' }, preset: { xRatio: 0.8, yRatio: 0.3, angle: 0 } }
};

function pseudoRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getGlitchNoise(time: number, speed: number): number {
  const t = Math.floor(time * speed);
  const r = pseudoRandom(t);
  return r > 0.9 ? (r - 0.95) * 50 : 0; 
}

function getBeatPulse(time: number) {
  const beat = Math.sin(time * 0.015); 
  return 1.0 + (beat * beat * beat) * 0.05;
}

function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

export class CanvasLogic {
  static isGrayscale = false;
  static lastEffectChange = 0;
  static lastLayoutId: LayoutId = 0;
  static layoutStartTime = 0;

  static resetEffects() {
    this.isGrayscale = false;
    this.lastEffectChange = 0;
    this.lastLayoutId = 0;
    this.layoutStartTime = 0;
  }

  static draw(
    ctx: CanvasRenderingContext2D,
    source: HTMLImageElement | HTMLVideoElement,
    text: string,
    time: number,
    config: any,
    layoutId: LayoutId = 0, 
    shrinkStartIndex: number = -1,
    presetText: string = ""
  ) {
    const canvas = ctx.canvas;
    const MAX_DIMENSION = 1280; 

    if (layoutId !== this.lastLayoutId) {
        this.lastLayoutId = layoutId;
        this.layoutStartTime = time; 
    }

    let rawW = 0, rawH = 0;
    if (source instanceof HTMLVideoElement) {
      rawW = source.videoWidth;
      rawH = source.videoHeight;
    } else {
      rawW = source.width;
      rawH = source.height;
    }
    
    if (rawW === 0 || rawH === 0) return;

    let scaleFactor = 1.0;
    if (rawW > MAX_DIMENSION || rawH > MAX_DIMENSION) {
      scaleFactor = Math.min(MAX_DIMENSION / rawW, MAX_DIMENSION / rawH);
    }

    const targetCanvasW = Math.floor(rawW * scaleFactor);
    const targetCanvasH = Math.floor(rawH * scaleFactor);

    if (canvas.width !== targetCanvasW || canvas.height !== targetCanvasH) {
      canvas.width = targetCanvasW;
      canvas.height = targetCanvasH;
    }
    
    const w = targetCanvasW;
    const h = targetCanvasH;

    if (time - this.lastEffectChange > 2000) { 
        if (Math.random() < 0.3) {
            this.isGrayscale = !this.isGrayscale;
        }
        this.lastEffectChange = time;
    }

    ctx.save();
    const pulse = getBeatPulse(time);
    const centerX = w / 2;
    const centerY = h / 2;
    ctx.translate(centerX, centerY);
    ctx.scale(pulse, pulse);
    ctx.translate(-centerX, -centerY);

    const shakeIntensity = config.shakeIntensity || 5;
    const rOffset = Math.sin(time * 0.02) * shakeIntensity * 2;
    const bOffset = Math.cos(time * 0.03) * shakeIntensity * 2;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    ctx.drawImage(source, 0, 0, w, h);

    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(source, rOffset, 0, w, h);
    ctx.drawImage(source, -bOffset, 0, w, h);

    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    if (this.isGrayscale) {
        ctx.save();
        ctx.globalCompositeOperation = "saturation";
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    if (Math.random() > 0.8) {
        const stripY = Math.random() * h;
        const stripH = Math.random() * 50;
        const stripOffset = (Math.random() - 0.5) * 50;
        try { ctx.drawImage(source, 0, stripY, w, stripH, stripOffset, stripY, w, stripH); } catch(e) {}
    }

    // ★ パターン番号表示を完全に削除
    if (!text) {
        ctx.restore();
        return;
    }

    const currentLayout = LAYOUTS[layoutId] || LAYOUTS[0];

    const isPortrait = h > w;
    const ratio = isPortrait ? 3.5 : config.fontSizeRatio; 
    const baseFontSize = Math.max(10, Math.floor(w / ratio));

    const chars = text.split('');
    const charData: any[] = [];
    let virtualWidth = 0;
    const spacingRatio = currentLayout.user.spacingRatio ?? 1.0;
    
    const isChaosMode = false;
    
    const spacingFirstSecond = 1; 
    const spacingSmall = 0.7;
    const spacingUserAutoGap = baseFontSize * -0.5;

    const smallChars = ['ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ャ', 'ュ', 'ョ', 'ッ'];
    
    ctx.font = `${baseFontSize}px 'KitchenGothic'`;

    chars.forEach((char, i) => {
      let scale = 1.0;
      let isMainText = false;
      let angle = 0; 
      
      if (isChaosMode) {
        if (i === 0) { scale = 2.5; isMainText = true; angle = -0.1; }
        else { scale = 1.2 + (Math.abs(Math.sin(i * 99)) * 0.8); angle = Math.cos(i) * 0.25; }
      } else {
        if (i === 0) { scale = 2.5; isMainText = true; }
        else if (i === 1) { scale = 2.0; isMainText = true; }
        else {
          if (shrinkStartIndex === -1 || i < shrinkStartIndex) { scale = 1.5; isMainText = true; }
          else {
            const offset = i - shrinkStartIndex;
            const length = chars.length - shrinkStartIndex;
            if (length > 0) scale = 0.8 - (offset / length) * 0.4;
            if (scale < 0.4) scale = 0.4;
          }
        }
      }

      if (shrinkStartIndex === -1 || i < shrinkStartIndex) {
        if (smallChars.includes(char)) scale *= 0.8;
      }

      const charSize = baseFontSize * scale;
      ctx.font = `${charSize}px 'KitchenGothic'`;
      const charW = ctx.measureText(char).width;
      
      let baseSpacing = isMainText ? 0.9 : 0.7; 

      if (i === 1) baseSpacing = spacingFirstSecond;
      if (smallChars.includes(char)) baseSpacing = spacingSmall;

      if (i === shrinkStartIndex && i > 0) {
          virtualWidth += spacingUserAutoGap;
      }

      const glitchX = (Math.random() < 0.1) ? (Math.random() - 0.5) * 20 : 0;
      const glitchY = (Math.random() < 0.1) ? (Math.random() - 0.5) * 20 : 0;

      charData.push({
        char, size: charSize, width: charW, scale, isMainText,
        xOffset: virtualWidth + glitchX,
        angle: angle,
        yJitter: glitchY
      });
      virtualWidth += charW * (baseSpacing * spacingRatio);
    });

    const uConf = currentLayout.user;
    let anchorX = w * uConf.xRatio;
    let anchorY = h * uConf.yRatio;
    
    let startX = anchorX;
    if (uConf.align === 'center') startX = anchorX - virtualWidth / 2;
    else if (uConf.align === 'right') startX = anchorX - virtualWidth;

    const arcDepth = h * uConf.arcDepthRatio;
    let minRelX = Infinity, maxRelX = -Infinity;
    let minRelY = Infinity, maxRelY = -Infinity;
    const SAFETY_PADDING = 25;

    charData.forEach((d) => {
      const lineX = startX + d.xOffset;
      const normalizedX = (lineX - w / 2) / (w * 0.5);
      const arcOffsetY = (normalizedX * normalizedX) * arcDepth;
      
      const relX = lineX - anchorX; 
      const slopeY = relX * uConf.slope;

      d.relToAnchorX = relX;
      d.relToAnchorY = (anchorY + slopeY + arcOffsetY + d.yJitter) - anchorY;

      const half = d.size / 2;
      const safeL = d.relToAnchorX - half - SAFETY_PADDING;
      const safeR = d.relToAnchorX + half + SAFETY_PADDING;
      const safeT = d.relToAnchorY - half - SAFETY_PADDING;
      const safeB = d.relToAnchorY + half + SAFETY_PADDING;

      if (safeL < minRelX) minRelX = safeL;
      if (safeR > maxRelX) maxRelX = safeR;
      if (safeT < minRelY) minRelY = safeT;
      if (safeB > maxRelY) maxRelY = safeB;
    });

    const contentW = maxRelX - minRelX;
    const contentH = maxRelY - minRelY;
    const targetAreaW = w * 1.0; 
    const targetAreaH = h * 1.0;
    
    let fitScale = 1.0;
    if (contentW > 0 && contentH > 0) {
       const sX = targetAreaW / contentW;
       const sY = targetAreaH / contentH;
       if (sX < 1.0 || sY < 1.0) fitScale = Math.min(sX, sY);
    }

    let actualLeft = anchorX + minRelX * fitScale;
    let actualRight = anchorX + maxRelX * fitScale;
    let actualTop = anchorY + minRelY * fitScale;
    let actualBottom = anchorY + maxRelY * fitScale;
    const edgeMargin = w * 0.05; 

    if (actualLeft < edgeMargin) anchorX += edgeMargin - actualLeft;
    else if (actualRight > w - edgeMargin) anchorX -= actualRight - (w - edgeMargin);

    if (actualTop < edgeMargin) anchorY += edgeMargin - actualTop;
    else if (actualBottom > h - edgeMargin) anchorY -= actualBottom - (h - edgeMargin);

    let slideOffsetX = 0;
    const localTime = time - this.layoutStartTime;
    const ANIM_DURATION = 300; 
    const isSlidePattern = [8, 9, 10, 11, 12, 13].includes(layoutId);

    if (isSlidePattern && localTime < ANIM_DURATION) {
        const progress = localTime / ANIM_DURATION;
        const ease = easeOutExpo(progress);
        const distance = w * 0.8; 
        if ([8, 9, 10].includes(layoutId)) {
            slideOffsetX = (1 - ease) * distance;
        } else {
            slideOffsetX = -(1 - ease) * distance;
        }
    }
    
    anchorX += slideOffsetX;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    const renderData = charData.map((d, i) => {
        const targetX = anchorX + d.relToAnchorX * fitScale;
        const targetY = anchorY + d.relToAnchorY * fitScale;
        
        const shakeSpeed = 2;
        const buzzMag = config.shakeIntensity * (d.isMainText ? 2 : 1) * fitScale * 2.5; 
        const buzzX = (Math.random() - 0.5) * buzzMag;
        const buzzY = (Math.random() - 0.5) * buzzMag;
        
        const jumpX = getGlitchNoise(time + i * 10, shakeSpeed) * fitScale;
        const jumpY = getGlitchNoise(time + i * 10 + 500, shakeSpeed) * fitScale;

        return {
            x: targetX + buzzX + jumpX,
            y: targetY + buzzY + jumpY,
            angle: d.angle,
            char: d.char,
            size: d.size * fitScale
        };
    });

    renderData.forEach(d => {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.angle);
        ctx.font = `${d.size}px 'KitchenGothic'`;
        
        ctx.fillStyle = "#000000"; 
        ctx.fillText(d.char, 0, 0);
        
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(2, d.size * 0.02);
        ctx.strokeText(d.char, 0, 0);
        
        ctx.restore();
    });

    if (presetText) {
      const pConf = currentLayout.preset;
      let pX = w * pConf.xRatio;
      let pY = h * pConf.yRatio;
      pX = Math.max(w * 0.35, Math.min(w * 0.65, pX));
      pY = Math.max(h * 0.15, Math.min(h * 0.85, pY));
      pX += (Math.random()-0.5)*10;
      pY += (Math.random()-0.5)*10;

      ctx.save();
      ctx.translate(pX, pY);
      ctx.rotate(pConf.angle);
      const pSize = baseFontSize * 2.0 * fitScale;
      ctx.font = `${pSize}px 'KitchenGothic'`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#000000";
      
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(2, pSize * 0.02);
      ctx.strokeText(presetText, 0, 0);
      ctx.fillText(presetText, 0, 0);
      ctx.restore();
    }

    ctx.restore();
    // ★ パターン番号表示を完全に削除
  }
}