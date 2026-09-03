import { describe, expect, it, vi } from 'vitest';
import { createRouteFaviconDiscoveryHandler } from './routeFaviconDiscovery';

describe('createRouteFaviconDiscoveryHandler', () => {
  it('ignores favicons for known application presets', () => {
    const onFaviconDiscovered = vi.fn();
    const handleFavicons = createRouteFaviconDiscoveryHandler(
      'gmail',
      onFaviconDiscovered,
    );

    handleFavicons(['https://mail.google.com/favicon.ico']);

    expect(onFaviconDiscovered).not.toHaveBeenCalled();
  });

  it('does not consume the one-shot update for unsafe candidates', () => {
    const onFaviconDiscovered = vi.fn();
    const handleFavicons = createRouteFaviconDiscoveryHandler(
      'link',
      onFaviconDiscovered,
    );

    handleFavicons(['data:image/png;base64,AAAA']);
    handleFavicons(['https://example.com/favicon.ico']);

    expect(onFaviconDiscovered).toHaveBeenCalledOnce();
    expect(onFaviconDiscovered).toHaveBeenCalledWith(
      'https://example.com/favicon.ico',
    );
  });

  it('emits only the first safe favicon for a custom route', () => {
    const onFaviconDiscovered = vi.fn();
    const handleFavicons = createRouteFaviconDiscoveryHandler(
      'link',
      onFaviconDiscovered,
    );

    handleFavicons(['https://example.com/first.ico']);
    handleFavicons(['https://example.com/second.ico']);

    expect(onFaviconDiscovered).toHaveBeenCalledOnce();
    expect(onFaviconDiscovered).toHaveBeenCalledWith(
      'https://example.com/first.ico',
    );
  });
});
