import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { StudentProfileProvider } from "./contexts/StudentProfileContext";
import ProfilePicker from "./components/ProfilePicker";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Students from "./pages/Students";
import StudentDetail from "./pages/StudentDetail";
import Teachers from "./pages/Teachers";
import Classes from "./pages/Classes";
import Schedule from "./pages/Schedule";
import Families from "./pages/Families";
import Admin from "./pages/Admin";
import ClassDetail from "./pages/ClassDetail";
import Dashboard from "./pages/Dashboard";
import TeacherClassDetail from "./pages/TeacherClassDetail";
import TeacherPayroll from "./pages/TeacherPayroll";
import TeacherAttendance from "./pages/TeacherAttendance";
import TeacherAssignments from "./pages/TeacherAssignments";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentAssignments from "./pages/StudentAssignments";
import Tuition from "./pages/Tuition";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <StudentProfileProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ProfilePicker />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* Admin-only routes */}
            <Route path="/students" element={<ProtectedRoute allowedRole="admin"><Students /></ProtectedRoute>} />
            <Route path="/students/:id" element={<ProtectedRoute allowedRole="admin"><StudentDetail /></ProtectedRoute>} />
            <Route path="/teachers" element={<ProtectedRoute allowedRole="admin"><Teachers /></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute allowedRole="admin"><Classes /></ProtectedRoute>} />
            <Route path="/families" element={<ProtectedRoute allowedRole="admin"><Families /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute allowedRole="admin"><Admin /></ProtectedRoute>} />
            <Route path="/admin/classes/:id" element={<ProtectedRoute allowedRole="admin"><ClassDetail /></ProtectedRoute>} />
            <Route path="/students/:id/tuition" element={<ProtectedRoute allowedRole="admin"><Tuition /></ProtectedRoute>} />
            
            {/* Teacher routes */}
            <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
            <Route path="/teacher/classes/:id" element={<TeacherClassDetail />} />
            <Route path="/teacher/payroll" element={<TeacherPayroll />} />
            <Route path="/teacher/attendance" element={<TeacherAttendance />} />
            <Route path="/teacher/assignments" element={<TeacherAssignments />} />
            
            {/* Student routes */}
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route path="/student/assignments" element={<StudentAssignments />} />
            
            {/* Shared routes */}
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/tuition" element={<Tuition />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </StudentProfileProvider>
  </QueryClientProvider>
);

export default App;
