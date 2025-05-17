import { Middleware } from '@reduxjs/toolkit';
import { createAction } from '@reduxjs/toolkit';

// Create a navigation action
export const navigateTo = createAction<string>('navigation/navigateTo');

// Navigation middleware that will be handled by the app
export const navigationMiddleware: Middleware = (store) => (next) => (action) => {
  if (navigateTo.match(action)) {
    // The navigation will be handled by a listener in the app
    // We just pass the action through
  }
  return next(action);
};