import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  ClipboardCheck, 
  Users, 
  BarChart3, 
  FileText, 
  Calendar,
  CalendarRange,
  GraduationCap,
  Layers,
  ArrowRight
} from 'lucide-react';
import { 
  SchoolGroupRecord, 
  TeacherRecord, 
  TeachingAssignmentRecord, 
  AcademicYearConfigRecord 
} from '../../types';
import { 
  getStoredSchoolYearConfig, 
  getLocalAcademicData, 
  generateGroupsFromYearConfig,
  getStoredSubjects
} from '../../utils/academicConfigService';
import { StudentsManagementTab } from './StudentsManagementTab';
import { AttendanceRegisterTab } from './AttendanceRegisterTab';
import { AbsenteeismDashboardTab } from './AbsenteeismDashboardTab';
import { AttendanceReportsTab } from './AttendanceReportsTab';

interface AttendanceMainProps {
  user: User;
  onNavigateToSchoolYear?: () => void;
}

export type AttendanceTabKey = 'students' | 'register' | 'dashboard' | 'reports';

export function AttendanceMain({ user, onNavigateToSchoolYear }: AttendanceMainProps) {
  const [activeTab, setActiveTab] = useState<AttendanceTabKey>('register');
  const [yearConfig, setYearConfig] = useState<AcademicYearConfigRecord>(getStoredSchoolYearConfig());
  const [availableGroups, setAvailableGroups] = useState<SchoolGroupRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignmentRecord[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Synchronize school year configuration & generated groups
  useEffect(() => {
    const yConfig = getStoredSchoolYearConfig();
    setYearConfig(yConfig);

    const localData = getLocalAcademicData();
    const groups = generateGroupsFromYearConfig(yConfig, localData.groups);
    setAvailableGroups(groups);
    setTeachers(localData.teachers);
    setSubjects(getStoredSubjects());
    setAssignments(localData.assignments);

    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, []);

  const schoolYear = yearConfig.year || new Date().getFullYear();

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Module Header */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-5 sticky top-0 z-20 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 max-w-7xl mx-auto">
          <div>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="p-2 sm:p-2.5 bg-purple-700 text-white rounded-xl shadow-xs shrink-0">
                <ClipboardCheck className="w-5 sm:w-6 h-5 sm:h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Asistencia Estudiantil
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Control de asistencia de clases, importación de estudiantes por curso, dashboard de ausentismo e informes oficiales
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-xl text-xs font-bold border border-purple-200">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span>Año Activo: {schoolYear}</span>
            </div>

            {availableGroups.length === 0 && onNavigateToSchoolYear && (
              <button
                type="button"
                onClick={onNavigateToSchoolYear}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors shadow-2xs"
                title="Configurar grados y cursos en Año Escolar"
              >
                <span>Configurar en Año Escolar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 4 Navigation Tabs */}
        <div className="flex items-center gap-2 max-w-7xl mx-auto mt-4 overflow-x-auto pb-1 scrollbar-none">
          {/* Tab 1: Registro de Asistencia */}
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'register'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>2. Registro de Asistencia</span>
          </button>

          {/* Tab 2: Gestión e Importación de Estudiantes */}
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'students'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>1. Gestión e Importación de Estudiantes</span>
          </button>

          {/* Tab 3: Dashboard de Ausentismo */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>3. Dashboard de Ausentismo</span>
          </button>

          {/* Tab 4: Informes y Reportes PDF */}
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'reports'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>4. Informes y Reportes PDF</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 p-3 sm:p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'students' && (
          <StudentsManagementTab
            user={user}
            schoolYear={schoolYear}
            yearConfig={yearConfig}
            availableGroups={availableGroups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
          />
        )}

        {activeTab === 'register' && (
          <AttendanceRegisterTab
            user={user}
            schoolYear={schoolYear}
            yearConfig={yearConfig}
            availableGroups={availableGroups}
            teachers={teachers}
            subjects={subjects}
            assignments={assignments}
            initialGroupId={selectedGroupId}
          />
        )}

        {activeTab === 'dashboard' && (
          <AbsenteeismDashboardTab
            user={user}
            schoolYear={schoolYear}
            yearConfig={yearConfig}
            availableGroups={availableGroups}
            teachers={teachers}
            subjects={subjects}
          />
        )}

        {activeTab === 'reports' && (
          <AttendanceReportsTab
            user={user}
            schoolYear={schoolYear}
            yearConfig={yearConfig}
            availableGroups={availableGroups}
            teachers={teachers}
            subjects={subjects}
          />
        )}
      </div>
    </div>
  );
}
