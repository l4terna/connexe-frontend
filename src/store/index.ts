import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { 
  persistStore, 
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { api, oneOffApi } from '@/api/api';
import { setupListeners } from '@reduxjs/toolkit/query';
import userReducer from './userSlice';
import authReducer from './authSlice';
import { navigationMiddleware } from './navigationMiddleware';

const persistConfig = {
  key: 'root',
  version: 1,
  storage,
  whitelist: ['user', 'auth'], // Persist user and auth state
};

const rootReducer = combineReducers({
  [api.reducerPath]: api.reducer,
  [oneOffApi.reducerPath]: oneOffApi.reducer,
  user: userReducer,
  auth: authReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(api.middleware, oneOffApi.middleware, navigationMiddleware),
});

export const persistor = persistStore(store);

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;