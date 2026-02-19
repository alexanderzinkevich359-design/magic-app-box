import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import CoachDashboard from "./pages/coach/CoachDashboard";
import CoachPrograms from "./pages/coach/CoachPrograms";
import ProgramEditor from "./pages/coach/ProgramEditor";
import CoachAthletes from "./pages/coach/CoachAthletes";
import ParentDashboard from "./pages/parent/ParentDashboard";
import AthleteDashboard from "./pages/athlete/AthleteDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/coach" element={
              <ProtectedRoute allowedRoles={["coach"]}><CoachDashboard /></ProtectedRoute>
            } />
            <Route path="/coach/programs" element={
              <ProtectedRoute allowedRoles={["coach"]}><CoachPrograms /></ProtectedRoute>
            } />
            <Route path="/coach/programs/:programId" element={
              <ProtectedRoute allowedRoles={["coach"]}><ProgramEditor /></ProtectedRoute>
            } />
            <Route path="/coach/athletes" element={
              <ProtectedRoute allowedRoles={["coach"]}><CoachAthletes /></ProtectedRoute>
            } />
            <Route path="/coach/*" element={
              <ProtectedRoute allowedRoles={["coach"]}><CoachDashboard /></ProtectedRoute>
            } />
            <Route path="/parent/*" element={
              <ProtectedRoute allowedRoles={["parent"]}><ParentDashboard /></ProtectedRoute>
            } />
            <Route path="/athlete/*" element={
              <ProtectedRoute allowedRoles={["athlete"]}><AthleteDashboard /></ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
