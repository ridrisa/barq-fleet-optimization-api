import { configureStore } from '@reduxjs/toolkit';
import routesReducer, { routesMiddleware } from './slices/routesSlice';
import demoReducer from './demoSlice';

export const store = configureStore({
  reducer: {
    routes: routesReducer,
    demo: demoReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Apply custom middleware configuration from routesSlice
      ...routesMiddleware,
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
