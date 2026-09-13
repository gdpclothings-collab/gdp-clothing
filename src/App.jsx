import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { CartProvider } from '@/lib/CartContext';
import { NotificationProvider } from '@/lib/NotificationContext';
import { UnsavedChangesProvider } from '@/lib/UnsavedChangesContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import StoreLayout from '@/components/storefront/Layout';
import DesktopGarmentSelectionFocus from '@/components/storefront/DesktopGarmentSelectionFocus';
import MaintenanceGate from '@/components/storefront/MaintenanceGate';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminMfaGate from '@/components/AdminMfaGate';
import Home from '@/pages/Home';
import Shop from '@/pages/Shop';

const loadAdminPage = async (loader) => {
  await import('@/lib/installAdminProductMediaOptimization');
  return loader();
};

const ProductDetail = lazy(() => import('@/pages/ProductDetail'));
const DTF = lazy(() => import('@/pages/DTF'));
const DTFGangSheet = lazy(() => import('@/pages/DTFGangSheet'));
const CustomStudio = lazy(() => import('@/pages/CustomStudioDesktopWorkspaceV2'));
const Cart = lazy(() => import('@/pages/Cart'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const OrderConfirmation = lazy(() => import('@/pages/OrderConfirmation'));
const Account = lazy(() => import('@/pages/Account'));
const Admin = lazy(() => loadAdminPage(() => import('@/pages/Admin')));
const AdminV2 = lazy(() => loadAdminPage(() => import('@/pages/AdminV2')));
const AdminMediaOptimizer = lazy(() => loadAdminPage(() => import('@/pages/AdminMediaOptimizer')));
const TemplateManager = lazy(() => import('@/pages/TemplateManager'));
const FAQ = lazy(() => import('@/pages/FAQ'));
const ContentPage = lazy(() => import('@/pages/ContentPage'));
// Auth pages
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-background">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      }
    >
      <MaintenanceGate>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route element={<StoreLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/dtf" element={<DTF />} />
            <Route path="/products/dtf-gang-sheet" element={<DTFGangSheet />} />
            <Route path="/dtf-gang-sheet" element={<DTFGangSheet />} />
            <Route path="/products/:slug" element={<ProductDetail />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/custom-studio" element={<CustomStudio />} />
            <Route path="/design" element={<CustomStudio />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order/:orderNumber" element={<OrderConfirmation />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/pages/:slug" element={<ContentPage />} />

            <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
              <Route path="/account" element={<Account />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute requiredRole="admin" unauthenticatedElement={<Navigate to="/login" replace />} forbiddenElement={<Navigate to="/" replace />} />}>
            <Route element={<AdminMfaGate />}>
              <Route path="/admin/legacy" element={<Admin />} />
              <Route path="/admin/custom-studio/templates" element={<TemplateManager />} />
              <Route path="/admin/media-optimizer" element={<AdminMediaOptimizer />} />
              <Route path="/admin/*" element={<AdminV2 />} />
            </Route>
          </Route>

          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </MaintenanceGate>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <CartProvider>
          <Router>
            <NotificationProvider>
              <UnsavedChangesProvider>
                <DesktopGarmentSelectionFocus />
                <ScrollToTop />
                <AuthenticatedApp />
              </UnsavedChangesProvider>
            </NotificationProvider>
          </Router>
          <Toaster />
        </CartProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App