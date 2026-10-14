import React, { useState } from 'react';
import { usePWAInstall } from '../core/react/usePWAInstall';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as an installed standalone app, suppress
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shadow-blue-500/20 active:scale-95"
        title="Install G-Squad as a real mobile app"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Install App (APK / PWA)</span>
      </button>

      {/* Installation Guide Modal (for iOS or browsers without native prompt) */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 select-none">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Install G-Squad App</h3>
                  <p className="text-[10px] text-slate-500">Android APK & iOS Mobile App</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-700">
              {isIOS ? (
                <>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5 text-[11px]">
                    <div className="font-bold text-blue-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Install on iPhone / iPad:</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1">
                      <li>Tap the <strong>Share</strong> button (box with arrow) at the bottom of Safari.</li>
                      <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                      <li>Tap <strong>Add</strong> in the top right corner.</li>
                    </ol>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-[11px]">
                    <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Install on Android (Chrome WebAPK):</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1">
                      <li>Tap the <strong>three dots menu (⋮)</strong> at the top right of Chrome.</li>
                      <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                      <li>Android will automatically install the real <strong>WebAPK</strong> on your phone.</li>
                    </ol>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Once installed, G-Squad runs as a standalone app from your app drawer with no browser bar and full background capability.
                  </p>
                </>
              )}
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
