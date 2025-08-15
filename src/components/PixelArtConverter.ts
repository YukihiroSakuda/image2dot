export class PixelArtConverter {
    processPixelConversion(originalImage: HTMLImageElement, selectedSize: number) {
        // 1. まず小さなキャンバスで量子化処理を行う
        const smallCanvas = document.createElement('canvas');
        const smallCtx = smallCanvas.getContext('2d');
        if (!smallCtx) throw new Error('Canvas context not available');
        
        smallCanvas.width = selectedSize;
        smallCanvas.height = selectedSize;
        smallCtx.imageSmoothingEnabled = false;
        
        // 元画像を小さなキャンバスに描画
        smallCtx.drawImage(originalImage, 0, 0, selectedSize, selectedSize);
        
        // 2. ピクセルデータを取得して量子化
        const imageData = smallCtx.getImageData(0, 0, selectedSize, selectedSize);
        const pixelData = this.quantizePixelData(imageData.data);
        
        // 3. 量子化されたデータから色を抽出
        const extractedColors = this.extractColorsFromPixelData(pixelData);
        
        return {
            pixelData,
            extractedColors
        };
    }
    
    quantizePixelData(data: Uint8ClampedArray): Uint8ClampedArray {
        const quantized = new Uint8ClampedArray(data.length);
        
        for (let i = 0; i < data.length; i += 4) {
            // 各色を8段階に量子化 (0, 36, 72, 108, 144, 180, 216, 255)
            // より細かい色分けで再現性を向上
            quantized[i] = Math.round(data[i] / 36) * 36;     // Red
            quantized[i + 1] = Math.round(data[i + 1] / 36) * 36; // Green
            quantized[i + 2] = Math.round(data[i + 2] / 36) * 36; // Blue
            quantized[i + 3] = data[i + 3]; // Alpha
        }
        
        return quantized;
    }
    
    extractColorsFromPixelData(pixelData: Uint8ClampedArray): Array<{r: number, g: number, b: number}> {
        const colorSet = new Set<string>();
        
        for (let i = 0; i < pixelData.length; i += 4) {
            const r = pixelData[i];
            const g = pixelData[i + 1];
            const b = pixelData[i + 2];
            const a = pixelData[i + 3];
            
            if (a > 0) { // 透明でないピクセルのみ
                colorSet.add(`${r},${g},${b}`);
            }
        }
        
        return Array.from(colorSet).map(colorStr => {
            const [r, g, b] = colorStr.split(',').map(Number);
            return { r, g, b };
        }).sort((a, b) => {
            // 明度でソート
            const brightnessA = (a.r * 299 + a.g * 587 + a.b * 114) / 1000;
            const brightnessB = (b.r * 299 + b.g * 587 + b.b * 114) / 1000;
            return brightnessB - brightnessA;
        });
    }
    
    drawToCanvas(
        canvas: HTMLCanvasElement,
        pixelData: Uint8ClampedArray,
        selectedSize: number,
        maxCanvasSize: number = 500
    ) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const displaySize = Math.min(maxCanvasSize, selectedSize * Math.max(8, Math.floor(maxCanvasSize / selectedSize)));
        
        canvas.width = displaySize;
        canvas.height = displaySize;
        canvas.style.width = displaySize + 'px';
        canvas.style.height = displaySize + 'px';
        
        ctx.imageSmoothingEnabled = false;
        
        // 量子化されたピクセルデータを直接描画
        const pixelSize = displaySize / selectedSize;
        
        for (let y = 0; y < selectedSize; y++) {
            for (let x = 0; x < selectedSize; x++) {
                const index = (y * selectedSize + x) * 4;
                const r = pixelData[index];
                const g = pixelData[index + 1];
                const b = pixelData[index + 2];
                
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            }
        }
        
        // グリッドを描画
        this.drawGrid(ctx, displaySize, selectedSize);
    }
    
    drawGrid(ctx: CanvasRenderingContext2D, displaySize: number, selectedSize: number) {
        const pixelSize = displaySize / selectedSize;
        
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 1;
        
        // 縦線
        for (let i = 0; i <= selectedSize; i++) {
            const x = i * pixelSize;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, displaySize);
            ctx.stroke();
        }
        
        // 横線
        for (let i = 0; i <= selectedSize; i++) {
            const y = i * pixelSize;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(displaySize, y);
            ctx.stroke();
        }
    }
    
    rgbToHsl(r: number, g: number, b: number): [number, number, number] {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h: number, s: number, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
                default: h = 0;
            }
            h /= 6;
        }
        
        return [h * 360, s * 100, l * 100];
    }
}