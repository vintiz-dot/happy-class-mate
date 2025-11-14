import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface StudentProfileContextType {
  studentId?: string;
  setStudentId: (id?: string) => void;
  isHydrated?: boolean;
}

const StudentProfileContext = createContext<StudentProfileContextType>({
  setStudentId: () => {},
  isHydrated: false,
});

export { StudentProfileContext };

export function StudentProfileProvider({ children }: { children: ReactNode }) {
  const [studentId, setStudentIdState] = useState<string | undefined>(undefined);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("selected_student_id");
    if (stored) setStudentIdState(stored);
    setIsHydrated(true);
  }, []);

  const setStudentId = (id?: string) => {
    if (id) {
      localStorage.setItem("selected_student_id", id);
    } else {
      localStorage.removeItem("selected_student_id");
    }
    setStudentIdState(id);
  };

  return (
    <StudentProfileContext.Provider value={{ studentId, setStudentId, isHydrated }}>
      {children}
    </StudentProfileContext.Provider>
  );
}

export function useStudentProfile() {
  return useContext(StudentProfileContext);
}
