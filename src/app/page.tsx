"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Image as ImageIcon, Sparkles, Camera, Wand2, Download, RotateCcw, Maximize, X } from 'lucide-react';
import { PixelArtConverter } from '@/components/PixelArtConverter';

export default function Home() {
  const [selectedSize, setSelectedSize] = useState(16);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [showStep2, setShowStep2] = useState(false);
  const [showStep3, setShowStep3] = useState(false);
  const [showStep4, setShowStep4] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pixelData, setPixelData] = useState<Uint8ClampedArray | null>(null);
  const [extractedColors, setExtractedColors] = useState<Array<{r: number, g: number, b: number}>>([]);
  const [currentColorFormat, setCurrentColorFormat] = useState<'hex' | 'rgb' | 'hsl'>('hex');
  const [selectedPixelColor, setSelectedPixelColor] = useState<{r: number, g: number, b: number} | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);
  const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);

  const converter = new PixelArtConverter();

  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;

    // 新しい画像を選択した時は以前の結果をリセット
    resetProcessingResults();

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setOriginalImage(img);
        setShowStep2(true);
        setShowStep3(true);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const resetProcessingResults = useCallback(() => {
    setPixelData(null);
    setExtractedColors([]);
    setSelectedPixelColor(null);
    setShowStep4(false);
    setIsLoading(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const convertToPixelArt = useCallback(async () => {
    if (!originalImage) return;

    setIsLoading(true);

    // 少し遅延を入れてユーザーに処理感を与える
    setTimeout(() => {
      const result = converter.processPixelConversion(originalImage, selectedSize);
      setPixelData(result.pixelData);
      setExtractedColors(result.extractedColors);
      setIsLoading(false);
      setShowStep4(true);
      
      // 結果までスクロール
      setTimeout(() => {
        document.getElementById('step4')?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 300);
    }, 1500);
  }, [originalImage, selectedSize, converter]);

  // キャンバスを描画
  useEffect(() => {
    if (pixelData && pixelCanvasRef.current) {
      converter.drawToCanvas(pixelCanvasRef.current, pixelData, selectedSize, 500);
      addCanvasClickListener(pixelCanvasRef.current);
      addCanvasHoverListener(pixelCanvasRef.current);
    }
  }, [pixelData, selectedSize, converter]);

  // フルスクリーンキャンバスを描画
  useEffect(() => {
    if (pixelData && fullscreenCanvasRef.current && isFullscreen) {
      const maxSize = Math.min(window.innerWidth * 0.6, window.innerHeight * 0.8);
      converter.drawToCanvas(fullscreenCanvasRef.current, pixelData, selectedSize, maxSize);
      addCanvasClickListener(fullscreenCanvasRef.current, true);
    }
  }, [pixelData, selectedSize, converter, isFullscreen]);

  // キャンバスクリック機能
  const addCanvasClickListener = useCallback((canvas: HTMLCanvasElement, isFullscreenCanvas = false) => {
    const handleClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      
      if (!pixelData) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      
      const pixelSize = canvas.width / selectedSize;
      
      // クリック位置をピクセル座標に変換
      const pixelX = Math.floor(x / pixelSize);
      const pixelY = Math.floor(y / pixelSize);
      
      if (pixelX >= 0 && pixelX < selectedSize && pixelY >= 0 && pixelY < selectedSize) {
        // ピクセルデータから直接色を取得
        const index = (pixelY * selectedSize + pixelX) * 4;
        const r = pixelData[index];
        const g = pixelData[index + 1];
        const b = pixelData[index + 2];
        
        setSelectedPixelColor({ r, g, b });
        
        // メインキャンバスの場合は色をハイライト
        if (!isFullscreenCanvas) {
          setTimeout(() => highlightColorInPalette({ r, g, b }), 0);
        }
        
        // 視覚的フィードバック（ピクセルハイライト）
        drawPixelHighlight(canvas, pixelX, pixelY, pixelSize);
      }
    };

    // パフォーマンス向上のため、passive: false で高速応答
    canvas.removeEventListener('click', handleClick);
    canvas.addEventListener('click', handleClick, { passive: false });
  }, [pixelData, selectedSize]);

  // ピクセルハイライト描画
  const drawPixelHighlight = useCallback((canvas: HTMLCanvasElement, pixelX: number, pixelY: number, pixelSize: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || !pixelData) return;

    // キャンバスを再描画
    converter.drawToCanvas(canvas, pixelData, selectedSize, canvas.width);
    
    // ハイライト枠を描画
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, pixelSize * 0.1);
    ctx.strokeRect(pixelX * pixelSize, pixelY * pixelSize, pixelSize, pixelSize);
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, pixelSize * 0.05);
    ctx.strokeRect(pixelX * pixelSize - 1, pixelY * pixelSize - 1, pixelSize + 2, pixelSize + 2);
  }, [pixelData, selectedSize, converter]);

  // キャンバスホバー機能（プレビュー）
  const addCanvasHoverListener = useCallback((canvas: HTMLCanvasElement) => {
    let isHovering = false;
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!pixelData || !isHovering) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      
      const pixelSize = canvas.width / selectedSize;
      const pixelX = Math.floor(x / pixelSize);
      const pixelY = Math.floor(y / pixelSize);
      
      if (pixelX >= 0 && pixelX < selectedSize && pixelY >= 0 && pixelY < selectedSize) {
        // ホバー時の軽いハイライト
        const ctx = canvas.getContext('2d');
        if (ctx) {
          converter.drawToCanvas(canvas, pixelData, selectedSize, canvas.width);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 1;
          ctx.strokeRect(pixelX * pixelSize, pixelY * pixelSize, pixelSize, pixelSize);
        }
      }
    };

    const handleMouseEnter = () => { isHovering = true; };
    const handleMouseLeave = () => { 
      isHovering = false;
      if (pixelData) {
        converter.drawToCanvas(canvas, pixelData, selectedSize, canvas.width);
      }
    };

    canvas.removeEventListener('mousemove', handleMouseMove);
    canvas.removeEventListener('mouseenter', handleMouseEnter);
    canvas.removeEventListener('mouseleave', handleMouseLeave);
    
    canvas.addEventListener('mousemove', handleMouseMove, { passive: true });
    canvas.addEventListener('mouseenter', handleMouseEnter);
    canvas.addEventListener('mouseleave', handleMouseLeave);
  }, [pixelData, selectedSize, converter]);

  // カラーパレットで色をハイライト
  const highlightColorInPalette = useCallback((selectedColor: {r: number, g: number, b: number}) => {
    requestAnimationFrame(() => {
      // 全てのカラーアイテムのハイライトをクリア
      const colorItems = document.querySelectorAll('.color-item');
      colorItems.forEach(item => {
        item.classList.remove('bg-yellow-300', 'transform', '-translate-y-1');
      });
      
      // 選択した色と同じ色のアイテムをハイライト
      const targetColor = `rgb(${selectedColor.r}, ${selectedColor.g}, ${selectedColor.b})`;
      colorItems.forEach(item => {
        const colorDiv = item.querySelector('div') as HTMLDivElement;
        if (colorDiv && colorDiv.style.backgroundColor === targetColor) {
          item.classList.add('bg-yellow-300', 'transform', '-translate-y-1');
          // スクロールして表示
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  }, []);

  const downloadPixelArt = useCallback(() => {
    if (!pixelData) return;

    const link = document.createElement('a');
    
    // 高解像度版を作成
    const highResCanvas = document.createElement('canvas');
    const highResCtx = highResCanvas.getContext('2d');
    if (!highResCtx) return;
    
    const size = selectedSize * 10; // 10倍のサイズ
    highResCanvas.width = size;
    highResCanvas.height = size;
    highResCtx.imageSmoothingEnabled = false;
    
    const pixelSize = size / selectedSize;
    
    // 量子化されたピクセルデータから高解像度で描画
    for (let y = 0; y < selectedSize; y++) {
        for (let x = 0; x < selectedSize; x++) {
            const index = (y * selectedSize + x) * 4;
            const r = pixelData[index];
            const g = pixelData[index + 1];
            const b = pixelData[index + 2];
            
            highResCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            highResCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
    }
    
    link.download = `ドット絵_${selectedSize}x${selectedSize}.png`;
    link.href = highResCanvas.toDataURL();
    
    // ダウンロード実行
    link.click();
  }, [pixelData, selectedSize]);

  const resetApp = useCallback(() => {
    setOriginalImage(null);
    setSelectedSize(16);
    setSelectedPixelColor(null);
    setPixelData(null);
    setShowStep2(false);
    setShowStep3(false);
    setShowStep4(false);
    setIsLoading(false);
    setExtractedColors([]);
    setCurrentColorFormat('hex');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const formatColor = (color: {r: number, g: number, b: number}, format: 'hex' | 'rgb' | 'hsl') => {
    const { r, g, b } = color;
    
    switch (format) {
        case 'hex':
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        case 'rgb':
            return `rgb(${r}, ${g}, ${b})`;
        case 'hsl':
            const [h, s, l] = converter.rgbToHsl(r, g, b);
            return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
        default:
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans relative overflow-x-hidden">
      {/* バウハウス風背景デザイン */}
      <div className="fixed inset-0 opacity-30 pointer-events-none z-0"
           style={{
             background: `
               radial-gradient(circle at 15% 25%, #dc2626 0%, transparent 20%),
               radial-gradient(circle at 85% 15%, #2563eb 0%, transparent 25%),
               radial-gradient(circle at 70% 75%, #eab308 0%, transparent 22%),
               radial-gradient(circle at 25% 80%, #000000 0%, transparent 18%),
               radial-gradient(circle at 90% 85%, #dc2626 0%, transparent 15%),
               radial-gradient(circle at 10% 60%, #2563eb 0%, transparent 20%),
               linear-gradient(45deg, transparent 30%, rgba(234, 179, 8, 0.1) 50%, transparent 70%),
               linear-gradient(-45deg, transparent 40%, rgba(37, 99, 235, 0.1) 60%, transparent 80%)
             `
           }}>
      </div>

      <div className="max-w-full mx-0 p-6 relative z-10">
        {/* ヘッダー */}
        <header className="text-center mb-12 p-8 border-b-[3px] border-black bg-white/95 rounded-xl shadow-[8px_8px_0px_#000000]">
          <h1 className="text-black text-4xl font-bold flex items-center justify-center gap-4 uppercase tracking-wider">
            <ImageIcon className="w-12 h-12 text-red-600" />
            <ruby>画像<rt className="text-xs text-gray-600 font-medium">がぞう</rt></ruby>を<ruby>ドット絵<rt className="text-xs text-gray-600 font-medium">どっとえ</rt></ruby>に<ruby>変<rt className="text-xs text-gray-600 font-medium">か</rt></ruby>える
            <Sparkles className="w-12 h-12 text-red-600" />
          </h1>
        </header>

        <main className="space-y-8">
          {/* ステップ1: 画像選択 */}
          <div className="bg-white/95 border-[3px] border-black rounded-xl p-8 shadow-[8px_8px_0px_#000000] relative">
            <div className="absolute -top-1.5 -left-1.5 -right-1.5 -bottom-1.5 bg-gradient-to-br from-red-600 via-blue-600 to-yellow-500 rounded-2xl opacity-10 -z-10"></div>
            
            <div className="flex items-center mb-6">
              <span className="bg-black text-white w-15 h-15 rounded-full flex items-center justify-center text-2xl font-bold mr-5 border-[3px] border-white shadow-[0_0_0_3px_#000000]">
                1
              </span>
              <h2 className="text-black text-2xl font-semibold">
                <ruby>画像<rt className="text-xs text-gray-600 font-medium">がぞう</rt></ruby>を<ruby>選<rt className="text-xs text-gray-600 font-medium">えら</rt></ruby>んでね！
              </h2>
            </div>
            
            <div 
              ref={uploadAreaRef}
              className="border-4 border-dashed border-black rounded-xl p-16 text-center cursor-pointer transition-all duration-300 bg-white/90 relative overflow-hidden min-h-[200px] flex flex-col items-center justify-center hover:bg-blue-50 hover:border-blue-600 hover:transform hover:-translate-y-1 hover:shadow-[8px_12px_0px_#000000]"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {originalImage ? (
                <img 
                  src={originalImage.src} 
                  alt="アップロードした画像" 
                  className="max-w-full max-h-75 border-[3px] border-black rounded-lg shadow-[4px_4px_0px_#000000] mb-4"
                />
              ) : (
                <>
                  <Camera className="w-20 h-20 mb-5 text-black" />
                  <p className="text-xl text-black font-medium">
                    ここをクリックして、<ruby>画像<rt className="text-xs text-gray-600 font-medium">がぞう</rt></ruby>を<ruby>選<rt className="text-xs text-gray-600 font-medium">えら</rt></ruby>んでね
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          </div>

          {/* ステップ2: サイズ選択 */}
          {showStep2 && (
            <div className="bg-white/95 border-[3px] border-black rounded-xl p-8 shadow-[8px_8px_0px_#000000] relative">
              <div className="absolute -top-1.5 -left-1.5 -right-1.5 -bottom-1.5 bg-gradient-to-br from-red-600 via-blue-600 to-yellow-500 rounded-2xl opacity-10 -z-10"></div>
              
              <div className="flex items-center mb-6">
                <span className="bg-black text-white w-15 h-15 rounded-full flex items-center justify-center text-2xl font-bold mr-5 border-[3px] border-white shadow-[0_0_0_3px_#000000]">
                  2
                </span>
                <h2 className="text-black text-2xl font-semibold">
                  <ruby>ドット絵<rt className="text-xs text-gray-600 font-medium">どっとえ</rt></ruby>の<ruby>大<rt className="text-xs text-gray-600 font-medium">おお</rt></ruby>きさを<ruby>選<rt className="text-xs text-gray-600 font-medium">えら</rt></ruby>んでね！
                </h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 max-w-4xl mx-auto">
                {[
                  { size: 8, label: 'とても小さい (8×8)' },
                  { size: 16, label: '小さい (16×16)' },
                  { size: 32, label: 'ふつう (32×32)' },
                  { size: 64, label: '大きい (64×64)' },
                  { size: 128, label: 'とても大きい (128×128)' }
                ].map(({ size, label }) => (
                  <button
                    key={size}
                    className={`bg-white/95 border-[3px] border-black rounded-xl p-6 cursor-pointer transition-all duration-300 text-center text-sm text-black font-semibold relative overflow-hidden hover:transform hover:-translate-y-1 hover:shadow-[8px_12px_0px_#000000] ${
                      selectedSize === size ? 'bg-yellow-500 shadow-[8px_8px_0px_#000000] transform -translate-y-1' : ''
                    }`}
                    onClick={() => setSelectedSize(size)}
                  >
                    <div className={`mx-auto mb-4 border-2 border-black bg-blue-600 rounded-sm`} style={{ width: `${Math.min(56, 24 + size/4)}px`, height: `${Math.min(56, 24 + size/4)}px` }}></div>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ステップ3: 変換 */}
          {showStep3 && (
            <div className="bg-white/95 border-[3px] border-black rounded-xl p-8 shadow-[8px_8px_0px_#000000] relative">
              <div className="absolute -top-1.5 -left-1.5 -right-1.5 -bottom-1.5 bg-gradient-to-br from-red-600 via-blue-600 to-yellow-500 rounded-2xl opacity-10 -z-10"></div>
              
              <div className="flex items-center mb-6">
                <span className="bg-black text-white w-15 h-15 rounded-full flex items-center justify-center text-2xl font-bold mr-5 border-[3px] border-white shadow-[0_0_0_3px_#000000]">
                  3
                </span>
                <h2 className="text-black text-2xl font-semibold">
                  <ruby>ドット絵<rt className="text-xs text-gray-600 font-medium">どっとえ</rt></ruby>を<ruby>作<rt className="text-xs text-gray-600 font-medium">つく</rt></ruby>る！
                </h2>
              </div>
              
              <div className="text-center">
                <button
                  className="bg-red-600 border-[3px] border-black rounded-xl px-10 py-5 text-xl text-white cursor-pointer transition-all duration-300 flex items-center justify-center gap-3 mx-auto mb-5 font-semibold shadow-[8px_8px_0px_#000000] uppercase tracking-wide hover:transform hover:-translate-y-1 hover:shadow-[8px_12px_0px_#000000] disabled:opacity-60"
                  onClick={convertToPixelArt}
                  disabled={isLoading}
                >
                  <Wand2 className="w-7 h-7" />
                  <ruby>ドット絵<rt className="text-xs text-red-200 font-medium">どっとえ</rt></ruby>に<ruby>変<rt className="text-xs text-red-200 font-medium">か</rt></ruby>える！
                </button>
                
                {isLoading && (
                  <div className="text-center my-10">
                    <div className="w-15 h-15 border-6 border-gray-300 border-t-red-600 rounded-full animate-spin mx-auto mb-5"></div>
                    <p className="text-lg">
                      <ruby>作<rt className="text-xs text-gray-600 font-medium">つく</rt></ruby>っているよ...
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ステップ4: 結果 */}
          {showStep4 && (
            <div id="step4" className="bg-white/95 border-[3px] border-black rounded-xl p-8 shadow-[8px_8px_0px_#000000] relative">
              <div className="absolute -top-1.5 -left-1.5 -right-1.5 -bottom-1.5 bg-gradient-to-br from-red-600 via-blue-600 to-yellow-500 rounded-2xl opacity-10 -z-10"></div>
              
              <div className="flex items-center mb-6">
                <span className="bg-black text-white w-15 h-15 rounded-full flex items-center justify-center text-2xl font-bold mr-5 border-[3px] border-white shadow-[0_0_0_3px_#000000]">
                  4
                </span>
                <h2 className="text-black text-2xl font-semibold">できあがり！</h2>
              </div>
              
              <div className="text-center">
                <div className="mb-8">
                  <h3 className="text-black mb-6 text-xl font-semibold">
                    <ruby>ドット絵<rt className="text-xs text-gray-600 font-medium">どっとえ</rt></ruby>の<ruby>完成<rt className="text-xs text-gray-600 font-medium">かんせい</rt></ruby>！
                  </h3>
                  
                  <div className="mb-6 flex justify-center">
                    <button
                      className="bg-white/95 border-[3px] border-black rounded-xl px-6 py-4 text-lg text-black cursor-pointer transition-all duration-300 flex items-center gap-2 font-semibold shadow-[4px_4px_0px_#000000] hover:bg-blue-50 hover:transform hover:-translate-y-1 hover:shadow-[4px_8px_0px_#000000]"
                      onClick={() => setIsFullscreen(true)}
                    >
                      <Maximize className="w-5 h-5" />
                      <ruby>大<rt className="text-xs text-gray-600 font-medium">おお</rt></ruby>きく<ruby>見<rt className="text-xs text-gray-600 font-medium">み</rt></ruby>る
                    </button>
                  </div>
                  
                  <div className="flex flex-col lg:flex-row gap-8 justify-start items-start mb-6 w-full">
                    <div className="flex-shrink-0">
                      <canvas 
                        ref={pixelCanvasRef}
                        className="border-[3px] border-black rounded-xl shadow-[8px_8px_0px_#000000] max-w-[500px] cursor-crosshair"
                      />
                    </div>
                    
                    {extractedColors.length > 0 && (
                      <div className="p-5 border-[3px] border-black rounded-xl bg-white/95 shadow-[8px_8px_0px_#000000] flex-1 min-w-[280px] h-fit">
                        <h4 className="mb-4 text-lg font-semibold text-black text-center">
                          <ruby>使<rt className="text-xs text-gray-600 font-medium">つか</rt></ruby>われている<ruby>色<rt className="text-xs text-gray-600 font-medium">いろ</rt></ruby>
                        </h4>
                        
                        {selectedPixelColor && (
                          <div className="mb-4 p-3 border-2 border-black rounded-lg bg-yellow-100">
                            <h5 className="text-sm font-semibold mb-2 text-center">
                              <ruby>選択<rt className="text-xs text-gray-600 font-medium">せんたく</rt></ruby>した<ruby>色<rt className="text-xs text-gray-600 font-medium">いろ</rt></ruby>
                            </h5>
                            <div className="flex items-center gap-2 justify-center">
                              <div 
                                className="w-8 h-8 border-2 border-black rounded-sm"
                                style={{ backgroundColor: `rgb(${selectedPixelColor.r}, ${selectedPixelColor.g}, ${selectedPixelColor.b})` }}
                              ></div>
                              <span className="font-mono text-sm font-semibold">
                                {formatColor(selectedPixelColor, currentColorFormat)}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex gap-2 mb-4 justify-center">
                          {(['hex', 'rgb', 'hsl'] as const).map((format) => (
                            <button
                              key={format}
                              className={`border-2 border-black rounded-md px-4 py-2 cursor-pointer transition-all duration-200 font-semibold text-black text-xs flex-1 hover:bg-yellow-200 hover:transform hover:-translate-y-0.5 ${
                                currentColorFormat === format ? 'bg-black text-white transform -translate-y-1' : 'bg-white/95'
                              }`}
                              onClick={() => setCurrentColorFormat(format)}
                            >
                              {format.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2.5 flex-1 overflow-y-auto max-h-[450px] pr-1.5">
                          {extractedColors.map((color, index) => (
                            <div
                              key={index}
                              className="color-item flex items-center gap-2.5 p-2 border-2 border-black rounded-md bg-white/95 text-xs font-semibold shadow-[3px_3px_0px_#000000] transition-all duration-200 cursor-pointer min-h-[40px] hover:transform hover:-translate-y-0.5 hover:shadow-[3px_4px_0px_#000000]"
                              onClick={() => setSelectedPixelColor(color)}
                            >
                              <div 
                                className="w-6 h-6 border-2 border-black rounded-sm flex-shrink-0"
                                style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                              ></div>
                              <span className="font-mono">{formatColor(color, currentColorFormat)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    className="bg-blue-600 border-[3px] border-black rounded-xl px-10 py-5 text-xl text-white cursor-pointer transition-all duration-300 flex items-center justify-center gap-3 font-semibold shadow-[8px_8px_0px_#000000] uppercase tracking-wide hover:transform hover:-translate-y-1 hover:shadow-[8px_12px_0px_#000000]"
                    onClick={downloadPixelArt}
                  >
                    <Download className="w-7 h-7" />
                    <ruby>ドット絵<rt className="text-xs text-blue-200 font-medium">どっとえ</rt></ruby>を<ruby>保存<rt className="text-xs text-blue-200 font-medium">ほぞん</rt></ruby>する
                  </button>
                  
                  <button
                    className="bg-yellow-500 text-black border-[3px] border-black rounded-xl px-10 py-5 text-xl cursor-pointer transition-all duration-300 flex items-center justify-center gap-3 font-semibold shadow-[8px_8px_0px_#000000] uppercase tracking-wide hover:transform hover:-translate-y-1 hover:shadow-[8px_12px_0px_#000000]"
                    onClick={resetApp}
                  >
                    <RotateCcw className="w-7 h-7" />
                    もう<ruby>一度作<rt className="text-xs text-yellow-800 font-medium">いちどつく</rt></ruby>る
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* フルスクリーンモーダル */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
          <div className="flex justify-between items-center p-6 bg-white/95 border-b-[3px] border-black">
            <h3 className="text-black text-xl font-semibold">
              <ruby>ドット絵<rt className="text-xs text-gray-600 font-medium">どっとえ</rt></ruby>を<ruby>大<rt className="text-xs text-gray-600 font-medium">おお</rt></ruby>きく<ruby>見<rt className="text-xs text-gray-600 font-medium">み</rt></ruby>る
            </h3>
            <button
              className="bg-red-600 border-[3px] border-black rounded-lg p-3 cursor-pointer transition-all duration-200 text-white shadow-[4px_4px_0px_#000000] hover:transform hover:-translate-y-1 hover:shadow-[4px_6px_0px_#000000]"
              onClick={() => setIsFullscreen(false)}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex-1 flex p-6 gap-6">
            <div className="flex-2 flex flex-col items-center justify-center relative">
              <canvas 
                ref={fullscreenCanvasRef}
                className="max-w-[80vh] max-h-[80vh] border-4 border-white rounded-xl cursor-crosshair shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              />
              <div className="mt-4 text-white text-sm bg-black/80 px-4 py-2 rounded-full border border-white">
                <ruby>色<rt className="text-xs text-gray-300 font-medium">いろ</rt></ruby>をクリックしてみてね！
              </div>
            </div>
            
            {selectedPixelColor && (
              <div className="flex-1 bg-white/95 border-[3px] border-black rounded-xl p-8 shadow-[8px_8px_0px_rgba(255,255,255,0.3)]">
                <h4 className="text-black text-xl font-semibold mb-6 text-center">
                  <ruby>選択<rt className="text-xs text-gray-600 font-medium">せんたく</rt></ruby>した<ruby>色<rt className="text-xs text-gray-600 font-medium">いろ</rt></ruby>
                </h4>
                
                <div className="text-center">
                  <div 
                    className="w-30 h-30 border-4 border-black rounded-xl mx-auto mb-6 shadow-[8px_8px_0px_rgba(0,0,0,0.3)]"
                    style={{ backgroundColor: `rgb(${selectedPixelColor.r}, ${selectedPixelColor.g}, ${selectedPixelColor.b})` }}
                  ></div>
                  
                  <div className="flex flex-col gap-4">
                    {(['hex', 'rgb', 'hsl'] as const).map((format) => (
                      <div 
                        key={format}
                        className="flex justify-between items-center p-3 border-2 border-black rounded-lg bg-white/80 shadow-[4px_4px_0px_rgba(0,0,0,0.2)]"
                      >
                        <span className="font-semibold text-black text-sm">{format.toUpperCase()}:</span>
                        <span className="font-mono text-sm font-semibold text-black bg-yellow-200 px-2 py-1 rounded border border-black">
                          {formatColor(selectedPixelColor, format)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
