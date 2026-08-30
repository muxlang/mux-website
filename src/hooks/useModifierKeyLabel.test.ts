import React from 'react';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import useModifierKeyLabel from './useModifierKeyLabel';

function setPlatform(platform: string): void {
  Object.defineProperty(navigator, 'platform', {
    configurable: true,
    value: platform,
  });
}

afterEach(() => {
  setPlatform('Linux x86_64');
  Object.defineProperty(navigator, 'userAgentData', {
    configurable: true,
    value: undefined,
  });
});

describe('useModifierKeyLabel', () => {
  it('uses the Command symbol for macOS platforms', () => {
    setPlatform('MacIntel');

    const { result } = renderHook(() => useModifierKeyLabel());

    expect(result.current).toBe('⌘');
  });

  it('recognizes Apple mobile platforms', () => {
    setPlatform('iPhone');

    const { result } = renderHook(() => useModifierKeyLabel());

    expect(result.current).toBe('⌘');
  });

  it('prefers userAgentData when available', () => {
    setPlatform('Linux x86_64');
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      value: { platform: 'macOS' },
    });

    const { result } = renderHook(() => useModifierKeyLabel());

    expect(result.current).toBe('⌘');
  });

  it('uses Ctrl on non-Apple platforms', () => {
    setPlatform('Win32');

    const { result } = renderHook(() => useModifierKeyLabel());

    expect(result.current).toBe('Ctrl');
  });

  it('uses Ctrl as the server-rendering snapshot', () => {
    setPlatform('MacIntel');

    function Probe() {
      return React.createElement('span', null, useModifierKeyLabel());
    }

    expect(renderToString(React.createElement(Probe))).toContain('>Ctrl</span>');
  });
});
