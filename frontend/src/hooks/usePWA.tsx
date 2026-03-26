/**
 * usePWA — registers service worker + handles install prompt
 * Import and call once in App.tsx
 */

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
  canInstall:    boolean;
  isInstalled:   boolean;
  isStandalone:  boolean;
  promptInstall: () => Promise<void>;
}

let _deferredPrompt: BeforeInstallPromptEvent | null = null;

export function usePWA(): PWAState {
  const [canInstall,   setCanInstall]   = useState(false);
  const [isInstalled,  setIsInstalled]  = useState(false);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true;

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(reg => console.log('[PWA] Service worker registered:', reg.scope))
        .catch(err => console.warn('[PWA] Service worker failed:', err));
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      _deferredPrompt = e as BeforeInstallPromptEvent;
      setCanInstall(true);
      console.log('[PWA] Install prompt ready');
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Detect if already installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setCanInstall(false);
      _deferredPrompt = null;
      console.log('[PWA] App installed!');
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const promptInstall = async () => {
    if (!_deferredPrompt) return;
    await _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    console.log('[PWA] Install outcome:', outcome);
    if (outcome === 'accepted') setIsInstalled(true);
    _deferredPrompt = null;
    setCanInstall(false);
  };

  return { canInstall, isInstalled, isStandalone, promptInstall };
}