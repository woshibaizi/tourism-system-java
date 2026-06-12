import React, { useState, useRef } from 'react';
import { Send, ImagePlus, X } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * 压缩图片：限制最大边长 1024px，JPEG 质量 0.7
 * 将 3-5MB 的照片压缩到 ~100-200KB，避免上传超限和 base64 body 过大
 */
const compressImage = (file) => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) {
          // 从 Blob 创建 File 对象，保留原始文件名
          const compressedFile = new File([blob], file.name || 'image.jpg', { type: 'image/jpeg' });
          resolve({ file: compressedFile, preview: canvas.toDataURL('image/jpeg', 0.7) });
        } else {
          // 降级：使用原始文件
          resolve({ file, preview: '' });
          const reader = new FileReader();
          reader.onload = () => {
            // 如果之前没有 preview，在这里设置
          };
          reader.readAsDataURL(file);
        }
      }, 'image/jpeg', 0.7);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // 降级：不压缩，直接用原文件
      const reader = new FileReader();
      reader.onload = () => resolve({ file, preview: reader.result });
      reader.readAsDataURL(file);
    };
    img.src = url;
  });
};

export default function ChatInput({ onSend, disabled, placeholder = '输入您的问题...' }) {
  const [value, setValue] = useState('');
  const [images, setImages] = useState([]);   // { file, preview } 列表
  const fileRef = useRef(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed && images.length === 0) return;
    if (disabled) return;
    onSend(trimmed, images);
    setValue('');
    setImages([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageAdd = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const compressed = await compressImage(file);
      if (compressed.preview) {
        setImages((p) => [...p, { file: compressed.file, preview: compressed.preview }]);
      }
    }
    // 清空 file input，允许重复选择同一文件
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleRemoveImage = (index) => {
    setImages((p) => p.filter((_, i) => i !== index));
  };

  const canSend = (value.trim() || images.length > 0) && !disabled;

  return (
    <div className="border-t border-neutral-100 bg-white">
      {/* 图片预览区 */}
      {images.length > 0 && (
        <div className="flex gap-2 px-4 pt-3 overflow-x-auto">
          {images.map((img, i) => (
            <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-border">
              <img src={img.preview} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => handleRemoveImage(i)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center hover:bg-red-50 transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 输入区 */}
      <div className="flex items-end gap-3 p-4">
        {/* 图片选择按钮 */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className={clsx(
            'p-2 rounded-lg transition-colors flex-shrink-0',
            disabled
              ? 'text-neutral-300 cursor-not-allowed'
              : 'text-muted hover:text-heading hover:bg-neutral-100'
          )}
          title="添加图片"
        >
          <ImagePlus size={20} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageAdd}
          className="hidden"
        />

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={images.length > 0 ? '添加描述（可选）...' : placeholder}
          disabled={disabled}
          rows={1}
          className={clsx(
            'flex-1 resize-none bg-transparent border-0 py-3 px-0 font-sans text-sm',
            'focus:ring-0 focus:outline-none placeholder:text-muted',
            'border-b border-neutral-200 focus:border-neutral-900 transition-colors'
          )}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={clsx(
            'p-3 rounded-sm transition-colors flex-shrink-0',
            canSend
              ? 'bg-black text-white hover:bg-neutral-800'
              : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
          )}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
