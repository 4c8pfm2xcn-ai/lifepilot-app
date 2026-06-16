import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

/**
 * voice.ts — the voice layer for LifePilot's assistant.
 *
 * Text-to-speech (responding back in voice) works fully on-device via
 * expo-speech. Speech-to-text (listening) is exposed through a small
 * recorder abstraction: in a custom dev build you can wire a native STT
 * engine (e.g. @react-native-voice/voice or a cloud transcription call)
 * into transcribe(); inside Expo Go we capture audio and return a manual
 * fallback so the assistant stays usable.
 */

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  voice?: string;
  language?: string;
  onStart?: () => void;
  onDone?: () => void;
}

let speaking = false;

export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!text) return;
  Speech.stop();
  speaking = true;
  Speech.speak(text, {
    rate: opts.rate ?? 1.0,
    pitch: opts.pitch ?? 1.0,
    voice: opts.voice,
    language: opts.language ?? 'en-US',
    onStart: opts.onStart,
    onDone: () => { speaking = false; opts.onDone?.(); },
    onStopped: () => { speaking = false; },
    onError: () => { speaking = false; },
  });
}

export function stopSpeaking(): void {
  Speech.stop();
  speaking = false;
}

export function isSpeaking(): boolean {
  return speaking;
}

export async function getVoices(): Promise<Speech.Voice[]> {
  try { return await Speech.getAvailableVoicesAsync(); } catch { return []; }
}

/* ---------- LISTENING (speech-to-text) ---------- */

let recording: Audio.Recording | null = null;

export async function requestMicPermission(): Promise<boolean> {
  try {
    const { granted } = await Audio.requestPermissionsAsync();
    return granted;
  } catch { return false; }
}

export async function startListening(): Promise<boolean> {
  try {
    const ok = await requestMicPermission();
    if (!ok) return false;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording: rec } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recording = rec;
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Stops recording and returns a transcript.
 * The recorded audio URI is passed to transcribe(); replace that function's
 * body with a real STT call in a dev build. Returns null if nothing usable.
 */
export async function stopListening(): Promise<{ uri: string | null }> {
  if (!recording) return { uri: null };
  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    return { uri: uri ?? null };
  } catch {
    recording = null;
    return { uri: null };
  }
}

export function isRecording(): boolean {
  return recording !== null;
}

/**
 * Pluggable transcription seam. In Expo Go this throws so the UI shows a
 * typed-input fallback; in a dev build, POST the audio file to your STT
 * provider (or use @react-native-voice/voice on-device) and return the text.
 */
export async function transcribe(_uri: string | null): Promise<string | null> {
  // e.g.
  // const form = new FormData();
  // form.append('file', { uri, name: 'speech.m4a', type: 'audio/m4a' } as any);
  // const res = await fetch(STT_ENDPOINT, { method: 'POST', body: form });
  // return (await res.json()).text;
  return null;
}
