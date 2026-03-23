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
import CoachTeams from "./pages/coach/CoachTeams";
import CoachSchedule from "./pages/coach/CoachSchedule";
import CoachBilling from "./pages/coach/CoachBilling";
import SessionLogger from "./pages/coach/SessionLogger";
import CoachDrills from "./pages/coach/CoachDrills";
import SpotlightStudio from "./pages/coach/SpotlightStudio";
import SpotlightCallback from "./pages/coach/SpotlightCallback";
import CoachGameLog from "./pages/coach/CoachGameLog";
import CoachAssistant from "./pages/coach/CoachAssistant";
import ParentDashboard from "./pages/parent/ParentDashboard";
import ParentBilling from "./pages/parent/ParentBilling";
import AthleteDashboard from "./pages/athlete/AthleteDashboard";
import AthleteSchedule from "./pages/athlete/AthleteSchedule";
import Settings from "./pages/Settings";
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
            <Route path="/coach/teams" element={
              <ProtectedRoute allowedRoles={["coach"]}><CoachTeams /></ProtectedRoute>
            } />
            <Route path="/coach/schedule" element={
              <ProtectedRoute allowedRoles={["coach"]}><CoachSchedule /></ProtectedRoute>
            } />
            <Route path="/coach/log-session" element={
              <ProtectedRoute allowedRoles={["coach"]}><SessionLogger /></ProtectedRoute>
            } />
            <Route path="/coach/billing" element={
              <ProtectedRoute allowedRoles={["coach"]}><CoachBilling /></ProtectedRoute>
            } />
            <Route path="/coach/drills" element={
              <ProtectedRoute allowedRoles={["coach"]}><CoachDrills /></ProtectedRoute>
            } />
            <Route path="/coach/spotlight" element={
              <ProtectedRoute allowedRoles={["coach"]}><SpotlightStudio /></ProtectedRoute>
            } />
            <Route path="/coach/spotlight/callback" element={<SpotlightCallback />} />
            <Route path="/coach/game-log" element={
              <ProtectedRoute allowedRoles={["coach"]}><CoachGameLog /></ProtectedRoute>
            } />
            <Route path="/coach/assistant" element={
              <ProtectedRoute allowedRoles={["coach"]}><CoachAssistant /></ProtectedRoute>
            } />
            <Route path="/coach/*" element={
              <ProtectedRoute allowedRoles={["coach"]}><CoachDashboard /></ProtectedRoute>
            } />
            <Route path="/parent" element={
              <ProtectedRoute allowedRoles={["parent"]}><ParentDashboard /></ProtectedRoute>
            } />
            <Route path="/parent/billing" element={
              <ProtectedRoute allowedRoles={["parent"]}><ParentBilling /></ProtectedRoute>
            } />
            <Route path="/athlete/schedule" element={
              <ProtectedRoute allowedRoles={["athlete"]}><AthleteSchedule /></ProtectedRoute>
            } />
            <Route path="/athlete/*" element={
              <ProtectedRoute allowedRoles={["athlete"]}><AthleteDashboard /></ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute><Settings /></ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
