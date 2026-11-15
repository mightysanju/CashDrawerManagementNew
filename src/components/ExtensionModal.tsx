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
} from 'lucide-react';

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFloatingBubbleEnabled: boolean;
  onToggleFloatingBubble: () => void;
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({
  isOpen,
  onClose,
  isFloatingBubbleEnabled,
  onToggleFloatingBubble,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-gray-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 rounded-xl">
              <Puzzle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">FrontDesk Pro — Browser Extension</h3>
              <p className="text-xs text-gray-400">Floating Shift Log & Lead Capture Assistant</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-700">
          {/* Benefit Card */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex items-start space-x-3.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg flex-shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-xs leading-relaxed">
              <strong className="text-blue-950 font-bold block mb-1">
                Log Leads & Complaints From Any Browser Tab
              </strong>
              Clerks can capture group sales leads, guest complaints, and handover notes from any active tab (PMS software, Gmail, Booking.com, Expedia) using a floating bubble without interrupting their workflow.
            </div>
          </div>

          {/* Live In-App Test Toggle */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-xs font-bold text-gray-900 block">
                  Interactive Floating Bubble
                </strong>
                <span className="text-[11px] text-gray-500">
                  {isFloatingBubbleEnabled
                    ? 'Active in the bottom-right corner of this page'
                    : 'Show floating bubble preview directly on this tab'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleFloatingBubble}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
                isFloatingBubbleEnabled
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isFloatingBubbleEnabled ? 'Disable Preview' : 'Enable Preview'}
            </button>
          </div>

          {/* Download & Install Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Install Chrome / Edge / Brave Extension
              </h4>
              <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Globe className="w-3 h-3 text-emerald-600" />
                <span>Production Pack</span>
              </span>
            </div>

            {/* Target Domain Callout */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-slate-600 font-medium">Default App Domain:</span>
                <code className="text-[11px] font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  https://cashdrawermanagement.netlify.app/app
                </code>
              </div>
              <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                (Editable via Extension Popup)
              </span>
            </div>

            {/* Download Button */}
            <a
              href="/frontdesk-pro-extension.zip"
              download="frontdesk-pro-extension.zip"
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-sm hover:shadow transition flex items-center justify-center space-x-2 text-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download Extension Package (.zip)</span>
            </a>

            {/* 3 Step Installation Guide */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  1
                </span>
                <div>
                  <strong className="text-gray-900 block font-semibold">Unzip the package</strong>
                  <span className="text-gray-500">Extract the downloaded <code className="bg-gray-200 px-1 py-0.5 rounded text-[10px]">frontdesk-pro-extension.zip</code> file on your computer.</span>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  2
                </span>
                <div>
                  <strong className="text-gray-900 block font-semibold">Open Chrome Extensions</strong>
                  <span className="text-gray-500">Go to <code className="bg-gray-200 px-1 py-0.5 rounded text-[10px]">chrome://extensions</code> and toggle on <strong className="text-gray-800">Developer mode</strong> in the top-right corner.</span>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  3
                </span>
                <div>
                  <strong className="text-gray-900 block font-semibold">Load unpacked</strong>
                  <span className="text-gray-500">Click <strong className="text-gray-800">Load unpacked</strong> and select the extracted folder (which contains <code className="bg-gray-200 px-1 py-0.5 rounded text-[10px]">manifest.json</code>). The floating bubble will appear on all browser tabs!</span>
                </div>
              </div>
            </div>
          </div>

          {/* Features Checkpoints */}
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Manifest V3 compatible</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Real-time P2P sync</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Automatic staff login detection</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Live revenue calculation</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-200 flex items-center justify-between text-xs">
          <span className="text-gray-500 flex items-center space-x-1">
            <Laptop className="w-3.5 h-3.5" />
            <span>Works in Chrome, Edge, Brave & Opera</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
