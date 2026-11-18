import React from 'react';
import {
  X,
  Download,
  Puzzle,
  CheckCircle2,
  Laptop,
  Layers,
  Sparkles,
  Globe,
  Sliders,
} from 'lucide-react';

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFloatingBubbleEnabled?: boolean;
  onToggleFloatingBubble?: () => void;
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-gray-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 rounded-xl">
              <Puzzle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <span>FrontDesk Pro — Chrome Extension</span>
              </h3>
              <p className="text-xs text-slate-400">Standalone Browser Driver for Shift Logs & Lead Capture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-gray-700">
          {/* Download Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-sm font-bold text-slate-900 block">Download Extension Package</strong>
                <p className="text-xs text-slate-500">Includes floating log book, dynamic category sync & DOM driver.</p>
              </div>
              <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                <Globe className="w-3 h-3 text-emerald-600" />
                <span>v1.0.0 Ready</span>
              </span>
            </div>

            <a
              href="/frontdesk-pro-extension.zip"
              download="frontdesk-pro-extension.zip"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-sm hover:shadow transition flex items-center justify-center space-x-2 text-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download frontdesk-pro-extension.zip</span>
            </a>
          </div>

          {/* 3 Step Installation Guide */}
          <div className="space-y-2.5 pt-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Quick Setup (3 Steps)
            </h4>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2.5 text-xs">
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  1
                </span>
                <div>
                  <strong className="text-gray-900 block font-semibold">Extract Zip File</strong>
                  <span className="text-gray-500">Unzip <code className="bg-gray-200 px-1 py-0.5 rounded text-[10px]">frontdesk-pro-extension.zip</code> into a local folder on your computer.</span>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  2
                </span>
                <div>
                  <strong className="text-gray-900 block font-semibold">Open Chrome Extensions</strong>
                  <span className="text-gray-500">Navigate to <code className="bg-gray-200 px-1 py-0.5 rounded text-[10px]">chrome://extensions</code> and enable <strong className="text-gray-800">Developer mode</strong> in the top right.</span>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  3
                </span>
                <div>
                  <strong className="text-gray-900 block font-semibold">Load unpacked folder</strong>
                  <span className="text-gray-500">Click <strong className="text-gray-800">Load unpacked</strong> and select the unzipped folder. Done! The floating log book is active on all tabs.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between text-xs">
          <span className="text-gray-500 flex items-center space-x-1">
            <Laptop className="w-3.5 h-3.5" />
            <span>Compatible with Chrome, Edge, Brave & Opera</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
