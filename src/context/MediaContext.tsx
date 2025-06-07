import React, { createContext, useContext, useRef } from 'react';
import { MediaSignature } from '../api/media';
import { mediaCache } from '../utils/mediaCache';

interface MediaContextType {
  getSignedUrl: (storageKey: string, currentUserId: number) => string | null;
  setSignedUrls: (signedUrls: Record<string, MediaSignature>) => void;
  hasSignedUrl: (storageKey: string) => boolean;
}

const MediaContext = createContext<MediaContextType | null>(null);

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const signedUrlsRef = useRef(new Map<string, MediaSignature>());

  const getSignedUrl = (storageKey: string, currentUserId: number): string | null => {
    // First check cache (using sync version for performance)
    const cachedUrl = mediaCache.getSync(storageKey);
    if (cachedUrl) {
      return cachedUrl;
    }

    // Fallback to in-memory signature
    const signature = signedUrlsRef.current.get(storageKey);
    
    if (!signature) return null;

    // Check if the signature is expired
    const expiresAt = new Date(signature.expires_at);
    const now = new Date();
    if (now >= expiresAt) {
      // Remove expired signature
      signedUrlsRef.current.delete(storageKey);
      return null;
    }

    // Construct the media URL with storage key in path and signature as query params
    const params = new URLSearchParams({
      sign: signature.sign,
      expires_at: signature.expires_at,
      user_id: currentUserId.toString()
    });

    const url = `/api/v1/media/${storageKey}?${params.toString()}`;
    
    // Cache the constructed URL (fire and forget)
    mediaCache.set(storageKey, url, signature.expires_at).catch(error => 
      console.warn('Failed to cache media URL:', error)
    );
    
    return url;
  };

  const setSignedUrls = (signedUrls: Record<string, MediaSignature>) => {
    const cacheEntries: Array<{ storageKey: string; url: string; expiresAt: string }> = [];
    
    Object.entries(signedUrls).forEach(([storageKey, signature]) => {
      signedUrlsRef.current.set(storageKey, signature);
      
      // Prepare for bulk cache insertion
      const params = new URLSearchParams({
        sign: signature.sign,
        expires_at: signature.expires_at,
        user_id: signature.user_id.toString()
      });
      
      const url = `/api/v1/media/${storageKey}?${params.toString()}`;
      cacheEntries.push({
        storageKey,
        url,
        expiresAt: signature.expires_at
      });
    });
    
    // Bulk insert into cache (fire and forget)
    if (cacheEntries.length > 0) {
      mediaCache.setMultiple(cacheEntries).catch(error => 
        console.warn('Failed to bulk cache media URLs:', error)
      );
    }
  };

  const hasSignedUrl = (storageKey: string): boolean => {
    // First check cache
    if (mediaCache.has(storageKey)) {
      return true;
    }

    // Fallback to in-memory signature
    const signature = signedUrlsRef.current.get(storageKey);
    
    if (!signature) return false;

    // Check if not expired
    const expiresAt = new Date(signature.expires_at);
    const now = new Date();
    return now < expiresAt;
  };

  return (
    <MediaContext.Provider value={{ getSignedUrl, setSignedUrls, hasSignedUrl }}>
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = (): MediaContextType => {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
};