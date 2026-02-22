
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import SettingsView from './components/SettingsView';
import History from './components/History';
import Navigation from './components/Navigation';
import Welcome from './components/Welcome';
import EmergencyOverlay from './components/EmergencyOverlay';
import LocationTracker from './components/LocationTracker';
import { AppStatus, TrustedContact, UserSettings, EmergencyLog, LocationData } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [isRegistered, setIsRegistered] = useState<boolean>(() => {
    return localStorage.getItem('avay_user_registered') === 'true';
  });
  
  const [settings, setSettings] = useState<UserSettings>({
    emergencyPhrase: 'Activate AVAY',
    backupPin: '1234',
    autoAudio: true,
    autoVideo: true,   // take photo by default when emergency triggers
    silentMode: true,
    locationTracking: true,
    shareLocationWithContacts: true
  });

  const [contacts, setContacts] = useState<TrustedContact[]>([
    { id: '1', name: 'Emergency Contact', phone: '911', relation: 'Authority' }
  ]);

  const [logs, setLogs] = useState<EmergencyLog[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);

  // Trigger emergency mode
  // helper to capture a still image + short audio snippet
  const captureMedia = async (): Promise<{ photoUrl?: string; audioUrl?: string }> => {
    let photoUrl: string | undefined;
    let audioUrl: string | undefined;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: settings.autoVideo ? { facingMode: 'user' } : false,
        audio: settings.autoAudio ? true : false,
      });

      // photo capture
      if (stream.getVideoTracks().length > 0) {
        try {
          const track = stream.getVideoTracks()[0];
          if ('ImageCapture' in window) {
            const imageCapture = new (window as any).ImageCapture(track);
            const blob: Blob = await imageCapture.takePhoto();
            photoUrl = URL.createObjectURL(blob);
          } else {
            // fallback using canvas
            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0);
            photoUrl = canvas.toDataURL('image/jpeg', 0.8);
            video.pause();
          }
        } catch (err) {
          console.warn('[App] Photo capture failed', err);
        }
      }

      // audio capture (3 seconds)
      if (stream.getAudioTracks().length > 0) {
        try {
          const recorder = new MediaRecorder(stream);
          const chunks: Blob[] = [];
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };
          recorder.start();
          await new Promise((r) => setTimeout(r, 3000));
          recorder.stop();
          await new Promise((r) => (recorder.onstop = r));
          const audioBlob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
          audioUrl = URL.createObjectURL(audioBlob);
        } catch (err) {
          console.warn('[App] Audio capture failed', err);
        }
      }

      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      console.error('[App] Could not access media devices:', err);
    }

    return { photoUrl, audioUrl };
  };

  const triggerEmergency = useCallback(() => {
    if (status === AppStatus.EMERGENCY) return;
    setStatus(AppStatus.EMERGENCY);
    console.log('ALERT: Emergency triggered! Sending notifications to:', contacts);

    const newLog: EmergencyLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      location: currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : { lat: 0, lng: 0 },
      status: 'sent'
    };

    setLogs(prev => [newLog, ...prev]);

    // enrich log with media once captured
    captureMedia().then(({ photoUrl, audioUrl }) => {
      setLogs(prev => prev.map(l => l.id === newLog.id ? { ...l, photoUrl, audioUrl } : l));
    });

    // Request location if not already tracking
    if (!currentLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLogs(prev => prev.map(l => l.id === newLog.id ? {
          ...l,
          location: { lat: pos.coords.latitude, lng: pos.coords.longitude }
        } : l));
      });
    }
  }, [status, contacts, currentLocation, settings]);

  const resolveEmergency = useCallback((pin: string) => {
    if (pin === settings.backupPin) {
      setStatus(AppStatus.IDLE);
      return true;
    }
    return false;
  }, [settings.backupPin]);


  // Global Key Listener for "Panic Pattern" (e.g. rapid spacebar or escape)
  useEffect(() => {
    let pressCount = 0;
    let lastPress = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (status === AppStatus.EMERGENCY) return;
      
      const now = Date.now();
      if (e.key === 'Escape' || e.key === 'Control') {
        if (now - lastPress < 500) {
          pressCount++;
        } else {
          pressCount = 1;
        }
        lastPress = now;

        if (pressCount >= 3) {
          triggerEmergency();
          pressCount = 0;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerEmergency, status]);

  if (!isRegistered) {
    return <Welcome onComplete={() => setIsRegistered(true)} />;
  }

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto shadow-xl relative">
        <LocationTracker 
          enabled={settings.locationTracking} 
          onLocationUpdate={setCurrentLocation}
        />
        
        <Navigation status={status} />
        
        <main className="flex-1 overflow-y-auto pb-20 p-4">
          <Routes>
            <Route path="/" element={
              <Dashboard 
                status={status} 
                onToggleArm={() => setStatus(status === AppStatus.IDLE ? AppStatus.ARMED : AppStatus.IDLE)} 
                onTrigger={triggerEmergency}
                settings={settings}
                currentLocation={currentLocation}
              />
            } />
            <Route path="/settings" element={
              <SettingsView 
                settings={settings} 
                setSettings={setSettings} 
                contacts={contacts} 
                setContacts={setContacts} 
              />
            } />
            <Route path="/history" element={<History logs={logs} currentLocation={currentLocation} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

        {status === AppStatus.EMERGENCY && (
          <EmergencyOverlay onResolve={resolveEmergency} settings={settings} />
        )}
      </div>
    </HashRouter>
  );
};

export default App;
