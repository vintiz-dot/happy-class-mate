import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { StudentProfileProvider } from "./contexts/StudentProfileContext";
import ProfilePicker from "./components/ProfilePicker";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Students from "./pages/Students";
import StudentDetail from "./pages/StudentDetail";
import Teachers from "./pages/Teachers";
import Classes from "./pages/Classes";
import Finance from "./pages/Finance";
import Schedule from "./pages/Schedule";
import Families from "./pages/Families";
import Admin from "./pages/Admin";
import ClassDetail from "./pages/ClassDetail";
import Dashboard from "./pages/Dashboard";
import TeacherClassDetail from "./pages/TeacherClassDetail";
import TeacherPayroll from "./pages/TeacherPayroll";
import TeacherAssignments from "./pages/TeacherAssignments";
import TeacherAttendance from "./pages/TeacherAttendance";
import StudentAssignments from "./pages/StudentAssignments";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
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
            <Route path="/students" element={<Students />} />
            <Route path="/students/:id" element={<StudentDetail />} />
            <Route path="/teachers" element={<Teachers />} />
            <Route path="/teacher/classes/:id" element={<TeacherClassDetail />} />
            <Route path="/teacher/payroll" element={<TeacherPayroll />} />
            <Route path="/teacher/assignments" element={<TeacherAssignments />} />
            <Route path="/teacher/attendance" element={<TeacherAttendance />} />
            <Route path="/student/assignments" element={<StudentAssignments />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/families" element={<Families />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/classes/:id" element={<ClassDetail />} />
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
