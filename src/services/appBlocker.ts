import { Platform, NativeModules } from 'react-native';
import { BlockedApp } from '../types';

/**
 * appBlocker.ts \u2014 LifePilot's app + game blocker.
 *
 * IMPORTANT (honest design note):
 * A sandboxed app cannot force-kill other apps. True blocking is delivered by
 * a NATIVE enforcement layer that requires a custom dev build + OS permission:
 *
 *   \u2022 iOS: FamilyControls + ManagedSettings + DeviceActivity (Screen Time).
 *           Needs the Family Controls entitlement and user authorization.
 *           When authorized, selected apps are shielded by the OS \u2014 launching
 *           them shows Apple's block screen. This is the strongest possible block.
 *
 *   \u2022 Android: an AccessibilityService (or UsageStatsManager polling) detects
 *           the foreground package; when a blocked app opens, we launch a full
 *           screen lock Activity / send the user to the home screen. Requires
 *           the user to grant Accessibility + Usage Access.
 *
 * This module talks to an optional native module ("LifePilotBlocker"). If that
 * module is present (dev build) we get real OS-level blocking. If it is absent
 * (Expo Go / web), we fall back to in-app accountability blocking: focus
 * sessions, lockout screen while in LifePilot, schedules and strict mode.
 *
 * No fake claims: isNativeEnforcementAvailable() reports the truth so the UI
 * can tell the user exactly what level of blocking is active.
 */

const Native = (NativeModules as any).LifePilotBlocker as
  | {
      isAuthorized(): Promise<boolean>;
      requestAuthorization(): Promise<boolean>;
      setBlockedApps(ids: string[]): Promise<void>;
      startShield(ids: string[]): Promise<void>;
      stopShield(): Promise<void>;
    }
  | undefined;

export function isNativeEnforcementAvailable(): boolean {
  return !!Native;
}

export function currentPlatform(): 'ios' | 'android' | 'unknown' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'unknown';
}

export async function isAuthorized(): Promise<boolean> {
  if (!Native) return false;
  try { return await Native.isAuthorized(); } catch { return false; }
}

/** Ask the OS for blocking permission (Screen Time / Accessibility). */
export async function requestAuthorization(): Promise<boolean> {
  if (!Native) return false;
  try { return await Native.requestAuthorization(); } catch { return false; }
}

/**
 * Begin shielding the given apps at the OS level (dev build only).
 * Returns true if native enforcement actually started.
 */
export async function startShield(appIds: string[]): Promise<boolean> {
  if (!Native) return false;
  try { await Native.setBlockedApps(appIds); await Native.startShield(appIds); return true; }
  catch { return false; }
}

export async function stopShield(): Promise<boolean> {
  if (!Native) return false;
  try { await Native.stopShield(); return true; } catch { return false; }
}

/** A starter catalog of commonly-blocked apps and games. */
export const DEFAULT_BLOCK_CATALOG: Omit<BlockedApp, 'id' | 'blocked'>[] = [
  { name: 'Instagram', category: 'social', icon: 'logo-instagram', androidPackage: 'com.instagram.android' },
  { name: 'TikTok', category: 'video', icon: 'musical-notes', androidPackage: 'com.zhiliaoapp.musically' },
  { name: 'YouTube', category: 'video', icon: 'logo-youtube', androidPackage: 'com.google.android.youtube' },
  { name: 'X (Twitter)', category: 'social', icon: 'logo-twitter', androidPackage: 'com.twitter.android' },
  { name: 'Facebook', category: 'social', icon: 'logo-facebook', androidPackage: 'com.facebook.katana' },
  { name: 'Snapchat', category: 'social', icon: 'logo-snapchat', androidPackage: 'com.snapchat.android' },
  { name: 'Reddit', category: 'social', icon: 'logo-reddit', androidPackage: 'com.reddit.frontpage' },
  { name: 'Netflix', category: 'video', icon: 'film-outline', androidPackage: 'com.netflix.mediaclient' },
  { name: 'Twitch', category: 'video', icon: 'logo-twitch', androidPackage: 'tv.twitch.android.app' },
  { name: 'Clash of Clans', category: 'game', icon: 'game-controller', androidPackage: 'com.supercell.clashofclans' },
  { name: 'Roblox', category: 'game', icon: 'game-controller', androidPackage: 'com.roblox.client' },
  { name: 'Candy Crush', category: 'game', icon: 'game-controller', androidPackage: 'com.king.candycrushsaga' },
  { name: 'Fortnite', category: 'game', icon: 'game-controller', androidPackage: 'com.epicgames.fortnite' },
  { name: 'PUBG Mobile', category: 'game', icon: 'game-controller', androidPackage: 'com.tencent.ig' },
  { name: 'Genshin Impact', category: 'game', icon: 'game-controller', androidPackage: 'com.miHoYo.GenshinImpact' },
  { name: 'Amazon', category: 'shopping', icon: 'cart-outline', androidPackage: 'com.amazon.mShop.android.shopping' },
  { name: 'Safari / Browser', category: 'browser', icon: 'globe-outline' },
];
