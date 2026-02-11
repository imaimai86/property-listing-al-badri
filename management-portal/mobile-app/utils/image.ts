import { CONFIG } from '../constants/Config';

export const getImageUrl = (item: any) => {
  if (!item) return 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=1000';

  const rawUrl = item.image || item.thumbnail;
  
  if (!rawUrl) {
    return 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=1000';
  }

  // If it's already a full URL, return it
  if (rawUrl.startsWith('http')) {
    return rawUrl;
  }

  // Otherwise, prepend the S3 base URL
  // Ensure we don't have double slashes
  const baseUrl = CONFIG.S3_BASE_URL.endsWith('/') ? CONFIG.S3_BASE_URL : `${CONFIG.S3_BASE_URL}/`;
  const path = rawUrl.startsWith('/') ? rawUrl.substring(1) : rawUrl;
  
  return `${baseUrl}${path}`;
};
