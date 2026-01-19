import React from 'react';
// Import routing components from react-router to avoid export issues in react-router-dom
import { HashRouter, Routes, Route, Navigate } from 'react-router';
import { AppProvider } from './AppProvider';

// Pages
import { Landing } from './pages/marketing/Landing';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { OnboardingWrapper } from './pages/auth/Onboarding';
import { PublicTenantWebsite } from './pages/public/PublicTenantWebsite';
import { TenantSharePage } from './pages/public/TenantSharePage';
import { QuoteAcceptancePage } from './pages/public/QuoteAcceptancePage';

// Tenant Pages
import { TenantLayout } from './pages/tenant/TenantLayout';
import { TenantDashboard } from './pages/tenant/Dashboard';
import { Customers } from './pages/tenant/Customers';
import { TenantProducts } from './pages/tenant/TenantProducts';
import { ProductEditor } from './pages/tenant/ProductEditor';
import { Quotes } from './pages/tenant/Quotes';
import { QuoteEditor } from './pages/tenant/QuoteEditor';
import { TenantSettings } from './pages/tenant/TenantSettings';

// Admin Pages
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminCMS } from './pages/admin/AdminCMS';
import { AdminTenants } from './pages/admin/AdminTenants';

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/c/:slug" element={<PublicTenantWebsite />} />
          <Route path="/share/:slug" element={<TenantSharePage />} />
          <Route path="/presupuestos/:id/aceptar" element={<QuoteAcceptancePage />} />
          
          {/* Onboarding */}
          <Route path="/onboarding" element={<OnboardingWrapper />} />
          
          {/* Tenant Routes */}
          <Route path="/t/:slug" element={<TenantLayout />}>
            <Route path="dashboard" element={<TenantDashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="products" element={<TenantProducts />} />
            <Route path="products/:id/edit" element={<ProductEditor />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="quotes/:id" element={<QuoteEditor />} />
            <Route path="settings" element={<TenantSettings />} />
          </Route>
          
          {/* Central System Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="cms" element={<AdminCMS />} />
            <Route path="tenants" element={<AdminTenants />} />
          </Route>
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}