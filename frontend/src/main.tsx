import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, ToastProvider } from './components/Providers';
import { Loading } from './components/UI';
import './styles.css';
const PublicSite = lazy(() => import('../../public-site/PublicSite'));
const CRM = lazy(() => import('../../crm/CRM'));
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route
              path="/crm/*"
              element={
                <AuthProvider>
                  <CRM />
                </AuthProvider>
              }
            />
            <Route path="/*" element={<PublicSite />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
