'use client';

import { useEffect, useRef, useState } from 'react';
import { XMarkIcon } from '@/components/icons';

interface FilterBottomSheetProps {
  title: string;
  options: readonly string[];
  selected: string[];
  onApply: (selected: string[]) => void;
  onClose: () => void;
}

export default function FilterBottomSheet({
  title,
  options,
  selected,
  onApply,
  onClose,
}: FilterBottomSheetProps) {
  const [localSelected, setLocalSelected] = useState<string[]>(selected);
  const [closing, setClosing] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => onClose(), 280);
  };

  const handleApply = () => {
    setClosing(true);
    setTimeout(() => onApply(localSelected), 280);
  };

  const toggleOption = (opt: string) => {
    setLocalSelected((prev) =>
      prev.includes(opt)
        ? prev.filter((v) => v !== opt)
        : [...prev, opt]
    );
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      handleClose();
    }
  };

  return (
    <div
      ref={backdropRef}
      className={`filter-bottomsheet-overlay ${closing ? 'filter-bottomsheet-closing' : ''}`}
      onClick={handleBackdropClick}
    >
      <div className={`filter-bottomsheet-container ${closing ? 'filter-bottomsheet-slide-down' : ''}`}>
        {/* Header */}
        <div className="filter-bottomsheet-header">
          <h3 className="text-base font-semibold text-surface-900">{title}</h3>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-100 transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-surface-500" />
          </button>
        </div>

        {/* Options Grid */}
        <div className="filter-bottomsheet-body">
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
              const isActive = localSelected.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggleOption(opt)}
                  className={`filter-bottomsheet-option ${isActive ? 'filter-bottomsheet-option-active' : ''}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="filter-bottomsheet-footer">
          <button
            onClick={() => setLocalSelected([])}
            className="flex-1 rounded-xl border border-surface-200 py-3 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-50"
          >
            초기화
          </button>
          <button
            onClick={handleApply}
            className="flex-[2] rounded-xl bg-surface-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-surface-800"
          >
            적용하기 {localSelected.length > 0 && `(${localSelected.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
