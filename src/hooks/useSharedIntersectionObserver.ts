import { useCallback, useEffect, useRef } from 'react';

// Global intersection observer manager
class IntersectionObserverManager {
  private observer: IntersectionObserver | null = null;
  private callbacks = new Map<Element, (isIntersecting: boolean) => void>();
  private observedElements = new WeakSet<Element>();

  private createObserver() {
    if (this.observer) return this.observer;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const callback = this.callbacks.get(entry.target);
          if (callback) {
            callback(entry.isIntersecting);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '500px', // Fixed margin for all images
      }
    );

    return this.observer;
  }

  observe(element: Element, callback: (isIntersecting: boolean) => void) {
    if (this.observedElements.has(element)) return;

    const observer = this.createObserver();
    this.callbacks.set(element, callback);
    this.observedElements.add(element);
    observer.observe(element);
  }

  unobserve(element: Element) {
    if (!this.observer || !this.observedElements.has(element)) return;

    this.observer.unobserve(element);
    this.callbacks.delete(element);
    this.observedElements.delete(element);

    // Clean up observer if no elements are being observed
    if (this.callbacks.size === 0) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.callbacks.clear();
  }
}

// Global instance
const observerManager = new IntersectionObserverManager();

export const useSharedIntersectionObserver = (
  callback: (isIntersecting: boolean) => void
) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const observe = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;

    observerManager.observe(element, (isIntersecting) => {
      callbackRef.current(isIntersecting);
    });
  }, []);

  const unobserve = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;

    observerManager.unobserve(element);
  }, []);

  useEffect(() => {
    observe();
    return unobserve;
  }, [observe, unobserve]);

  return { elementRef };
};