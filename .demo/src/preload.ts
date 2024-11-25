export function preload(
  href: string,
  rel: string,
  as: string,
  type: string,
): void {
  const preloadLink = document.createElement('link');
  preloadLink.setAttribute('rel', rel);
  preloadLink.setAttribute('as', as);
  preloadLink.setAttribute('type', type);
  preloadLink.setAttribute('href', href);
  document.head.append(preloadLink);
}
