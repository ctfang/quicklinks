import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  isDestructive = true
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shrink-0 ${isDestructive ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
              <p className="text-white/70 text-sm leading-relaxed">{message}</p>
            </div>
          </div>
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-3 rounded-xl transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 font-medium py-3 rounded-xl transition-colors ${
              isDestructive 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
