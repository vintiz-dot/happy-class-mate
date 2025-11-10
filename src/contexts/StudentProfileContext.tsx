import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface StudentProfileContextType {
  studentId?: string;
  setStudentId: (id?: string) => void;
}

const StudentProfileContext = createContext<StudentProfileContextType>({
  setStudentId: () => {},
});

export { StudentProfileContext };

export function StudentProfileProvider({ children }: { children: ReactNode }) {
  const [studentId, setStudentIdState] = useState<string | undefined>(undefined);

  useEffect(() => {
    const stored = localStorage.getItem("selected_student_id");
    if (stored) setStudentIdState(stored);
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
    <StudentProfileContext.Provider value={{ studentId, setStudentId }}>
      {children}
    </StudentProfileContext.Provider>
  );
}

export function useStudentProfile() {
  return useContext(StudentProfileContext);
}
