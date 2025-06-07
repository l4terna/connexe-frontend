import React, { createContext, useContext, useRef } from 'react';
import { MediaSignature } from '../api/media';

interface MediaContextType {
  getSignedUrl: (storageKey: string, currentUserId: number) => string | null;
  setSignedUrls: (signedUrls: Record<string, MediaSignature>) => void;
  hasSignedUrl: (storageKey: string) => boolean;
}

const MediaContext = createContext<MediaContextType | null>(null);

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const signedUrlsRef = useRef(new Map<string, MediaSignature>());

  const getSignedUrl = (storageKey: string, currentUserId: number): string | null => {
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
    return url;
  };

  const setSignedUrls = (signedUrls: Record<string, MediaSignature>) => {
    Object.entries(signedUrls).forEach(([storageKey, signature]) => {
      signedUrlsRef.current.set(storageKey, signature);
    });
  };

  const hasSignedUrl = (storageKey: string): boolean => {
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