import { useSyncExternalStore } from 'react';

/**
 * Returns the label for the "run" modifier key, matching the user's OS: the
 * Command symbol on macOS and "Ctrl" elsewhere. Monaco's `CtrlCmd` keybinding
 * already maps to the correct physical key per platform; this only fixes the
 * displayed hint (issue #2).
 *
 * Implemented with useSyncExternalStore so server rendering and hydration use
 * "Ctrl" (the server snapshot) and the client swaps to the macOS symbol after
 * hydration without a mismatch. The platform never changes at runtime, so the
 * subscribe callback is a no-op.
 */
const noopSubscribe = () => () => {};

function getClientSnapshot(): string {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ||
    navigator.platform ||
    '';
  return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘' : 'Ctrl';
}

export default function useModifierKeyLabel(): string {
  return useSyncExternalStore(noopSubscribe, getClientSnapshot, () => 'Ctrl');
}
