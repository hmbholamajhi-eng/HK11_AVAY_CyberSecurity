
export enum AppStatus {
  IDLE = 'IDLE',
  ARMED = 'ARMED',
  EMERGENCY = 'EMERGENCY',
  RESOLVED = 'RESOLVED'
}

export interface TrustedContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

export interface UserSettings {
  emergencyPhrase: string;
  backupPin: string;
  autoAudio: boolean;
  autoVideo: boolean;
  silentMode: boolean;
  locationTracking: boolean;
  shareLocationWithContacts: boolean;
}

export interface EmergencyLog {
  id: string;
  timestamp: Date;
  location: { lat: number; lng: number };
  photoUrl?: string;            // optional snapshot taken when emergency triggered
  audioUrl?: string;            // optional audio recording URL
  status: 'sent' | 'failed' | 'processing';
}

export interface MediaEvidence {
  id: string;
  emergencyId: string;
  timestamp: Date;
  location: { lat: number; lng: number };
  photoBlob?: Blob;
  photoUrl?: string;
  videoBlob?: Blob;
  videoUrl?: string;
  audioBlob?: Blob;
  audioUrl?: string;
  storageKey?: string; // ADDED: localStorage key for persistent retrieval
  type: 'photo' | 'video' | 'audio' | 'combined';
  captureStatus: 'capturing' | 'captured' | 'processing';
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}
