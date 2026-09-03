import { getSafeFaviconUrl } from '../../common/utils/getSafeFaviconUrl';

type FaviconDiscoveredCallback = (faviconUrl: string) => void;

export const createRouteFaviconDiscoveryHandler = (
  icon: string,
  onFaviconDiscovered: FaviconDiscoveredCallback,
) => {
  let hasDiscoveredFavicon = false;

  return (favicons: readonly string[]) => {
    if (icon !== 'link' || hasDiscoveredFavicon) {
      return;
    }

    const faviconUrl = getSafeFaviconUrl(favicons);
    if (!faviconUrl) {
      return;
    }

    hasDiscoveredFavicon = true;
    onFaviconDiscovered(faviconUrl);
  };
};
