import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute, AdminRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/theme-provider";
import Landing from "./pages/Landing";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Diary from "./pages/Diary";
import Products from "./pages/Products";
import Achievements from "./pages/Achievements";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/diary" element={<Diary />} />
                <Route path="/products" element={<Products />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
