export class PixelArtConverter {
    processPixelConversion(originalImage: HTMLImageElement, selectedSize: number, colorReductionLevel: 'low' | 'medium' | 'high' = 'medium') {
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
        const quantizedPixelData = this.quantizePixelData(imageData.data, colorReductionLevel);
        
        // 3. 量子化されたデータから色を抽出（類似色マージ含む）
        const originalColors = this.extractColorsFromQuantizedData(quantizedPixelData);
        const reducedColors = this.reduceSimilarColors(originalColors, colorReductionLevel);
        
        // 4. 色数削減後のピクセルデータに再マッピング
        const finalPixelData = this.remapPixelDataToReducedPalette(
            quantizedPixelData, 
            originalColors, 
            reducedColors
        );
        
        return {
            pixelData: finalPixelData,
            extractedColors: reducedColors
        };
    }
    
    // 量子化されたデータから色を抽出（類似色マージなし）
    extractColorsFromQuantizedData(pixelData: Uint8ClampedArray): Array<{r: number, g: number, b: number}> {
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
    
    quantizePixelData(data: Uint8ClampedArray, reductionLevel: 'low' | 'medium' | 'high' = 'medium'): Uint8ClampedArray {
        const quantized = new Uint8ClampedArray(data.length);
        
        // 削減レベルに応じた量子化強度を設定
        const quantizationLevels = {
            low: 32,    // 8段階量子化 (0, 32, 64, 96, 128, 160, 192, 224, 255)
            medium: 64, // 4段階量子化 (0, 64, 128, 192, 255)  
            high: 128   // 2段階量子化 (0, 128, 255)
        };
        
        const step = quantizationLevels[reductionLevel];
        
        for (let i = 0; i < data.length; i += 4) {
            quantized[i] = Math.round(data[i] / step) * step;     // Red
            quantized[i + 1] = Math.round(data[i + 1] / step) * step; // Green
            quantized[i + 2] = Math.round(data[i + 2] / step) * step; // Blue
            quantized[i + 3] = data[i + 3]; // Alpha
        }
        
        return quantized;
    }
    
    // K-meansクラスタリングを使って色数削減
    reduceSimilarColors(colors: Array<{r: number, g: number, b: number}>, reductionLevel: 'low' | 'medium' | 'high' = 'medium'): Array<{r: number, g: number, b: number}> {
        console.log(`色数削減開始: ${colors.length}色 -> レベル: ${reductionLevel}`);
        
        // 削減レベルに応じた目標色数を設定
        const targetColors = {
            low: Math.min(32, Math.max(16, Math.floor(colors.length * 0.8))),
            medium: Math.min(16, Math.max(8, Math.floor(colors.length * 0.5))),
            high: Math.min(8, Math.max(4, Math.floor(colors.length * 0.3)))
        };
        
        const k = targetColors[reductionLevel];
        
        if (colors.length <= k) {
            console.log(`色数削減スキップ: ${colors.length}色（目標: ${k}色）`);
            return colors;
        }
        
        // K-meansクラスタリングで色数削減
        const reducedColors = this.kMeansClustering(colors, k);
        
        console.log(`色数削減完了: ${colors.length}色 -> ${reducedColors.length}色`);
        return reducedColors;
    }
    
    // K-meansクラスタリング実装
    kMeansClustering(colors: Array<{r: number, g: number, b: number}>, k: number): Array<{r: number, g: number, b: number}> {
        if (colors.length <= k) return colors;
        
        // 初期重心をランダムに選択
        let centroids = this.initializeCentroids(colors, k);
        let iterations = 0;
        const maxIterations = 20;
        
        while (iterations < maxIterations) {
            // 各色を最も近い重心に割り当て
            const clusters: Array<Array<{r: number, g: number, b: number}>> = Array.from({ length: k }, () => []);
            
            for (const color of colors) {
                let minDistance = Infinity;
                let closestCentroid = 0;
                
                for (let i = 0; i < centroids.length; i++) {
                    const distance = this.calculateColorDistance(color, centroids[i]);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestCentroid = i;
                    }
                }
                
                clusters[closestCentroid].push(color);
            }
            
            // 新しい重心を計算
            const newCentroids = clusters.map(cluster => {
                if (cluster.length === 0) return centroids[clusters.indexOf(cluster)];
                return this.averageColors(cluster);
            });
            
            // 収束判定
            let converged = true;
            for (let i = 0; i < centroids.length; i++) {
                if (this.calculateColorDistance(centroids[i], newCentroids[i]) > 1) {
                    converged = false;
                    break;
                }
            }
            
            centroids = newCentroids;
            iterations++;
            
            if (converged) break;
        }
        
        return centroids.filter(centroid => 
            centroid.r !== undefined && centroid.g !== undefined && centroid.b !== undefined
        );
    }
    
    // 初期重心を選択
    initializeCentroids(colors: Array<{r: number, g: number, b: number}>, k: number): Array<{r: number, g: number, b: number}> {
        const centroids: Array<{r: number, g: number, b: number}> = [];
        const used = new Set<number>();
        
        // K-means++法で初期重心を選択
        // 最初の重心をランダムに選択
        const firstIndex = Math.floor(Math.random() * colors.length);
        centroids.push(colors[firstIndex]);
        used.add(firstIndex);
        
        // 残りの重心を距離に基づいて選択
        for (let i = 1; i < k; i++) {
            const distances: number[] = [];
            let totalDistance = 0;
            
            for (let j = 0; j < colors.length; j++) {
                if (used.has(j)) {
                    distances[j] = 0;
                    continue;
                }
                
                let minDistance = Infinity;
                for (const centroid of centroids) {
                    const distance = this.calculateColorDistance(colors[j], centroid);
                    minDistance = Math.min(minDistance, distance);
                }
                distances[j] = minDistance * minDistance;
                totalDistance += distances[j];
            }
            
            // 重み付きランダム選択
            let randomValue = Math.random() * totalDistance;
            for (let j = 0; j < colors.length; j++) {
                if (used.has(j)) continue;
                randomValue -= distances[j];
                if (randomValue <= 0) {
                    centroids.push(colors[j]);
                    used.add(j);
                    break;
                }
            }
        }
        
        return centroids;
    }
    
    // 色の距離を計算（ユークリッド距離）
    calculateColorDistance(color1: {r: number, g: number, b: number}, color2: {r: number, g: number, b: number}): number {
        const dr = color1.r - color2.r;
        const dg = color1.g - color2.g;
        const db = color1.b - color2.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }
    
    // 複数色の平均を計算
    averageColors(colors: Array<{r: number, g: number, b: number}>): {r: number, g: number, b: number} {
        if (colors.length === 0) return { r: 0, g: 0, b: 0 };
        
        const sum = colors.reduce((acc, color) => ({
            r: acc.r + color.r,
            g: acc.g + color.g,
            b: acc.b + color.b
        }), { r: 0, g: 0, b: 0 });
        
        return {
            r: Math.round(sum.r / colors.length),
            g: Math.round(sum.g / colors.length),
            b: Math.round(sum.b / colors.length)
        };
    }
    
    // パレット削減後のピクセルデータを再マッピング
    remapPixelDataToReducedPalette(
        pixelData: Uint8ClampedArray, 
        originalColors: Array<{r: number, g: number, b: number}>, 
        reducedColors: Array<{r: number, g: number, b: number}>
    ): Uint8ClampedArray {
        const remapped = new Uint8ClampedArray(pixelData.length);
        
        // 各元色に対応する削減後の色のマッピングを作成
        const colorMap = new Map<string, {r: number, g: number, b: number}>();
        
        for (const originalColor of originalColors) {
            // 最も近い削減後の色を見つける
            let minDistance = Infinity;
            let closestColor = reducedColors[0];
            
            for (const reducedColor of reducedColors) {
                const distance = this.calculateColorDistance(originalColor, reducedColor);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestColor = reducedColor;
                }
            }
            
            const colorKey = `${originalColor.r},${originalColor.g},${originalColor.b}`;
            colorMap.set(colorKey, closestColor);
        }
        
        // ピクセルデータを再マッピング
        for (let i = 0; i < pixelData.length; i += 4) {
            const r = pixelData[i];
            const g = pixelData[i + 1];
            const b = pixelData[i + 2];
            const a = pixelData[i + 3];
            
            const colorKey = `${r},${g},${b}`;
            const mappedColor = colorMap.get(colorKey) || { r, g, b };
            
            remapped[i] = mappedColor.r;
            remapped[i + 1] = mappedColor.g;
            remapped[i + 2] = mappedColor.b;
            remapped[i + 3] = a;
        }
        
        return remapped;
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
        
        const colors = Array.from(colorSet).map(colorStr => {
            const [r, g, b] = colorStr.split(',').map(Number);
            return { r, g, b };
        }).sort((a, b) => {
            // 明度でソート
            const brightnessA = (a.r * 299 + a.g * 587 + a.b * 114) / 1000;
            const brightnessB = (b.r * 299 + b.g * 587 + b.b * 114) / 1000;
            return brightnessB - brightnessA;
        });
        
        // 類似色をマージして色数削減
        return this.reduceSimilarColors(colors);
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