import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  FileCheck2, 
  ClipboardList, 
  History, 
  FileDown, 
  Calendar,
  Users,
  BarChart3
} from 'lucide-react';
import { 
  SchoolGroupRecord, 
  AcademicYearConfigRecord,
  TeacherRecord 
} from '../../types';
import { 
  getStoredSchoolYearConfig, 
  getLocalAcademicData, 
  generateGroupsFromYearConfig,
  getStoredSubjects
} from '../../utils/academicConfigService';
import { PermissionRegisterTab } from './PermissionRegisterTab';
import { PermissionsListTab } from './PermissionsListTab';
import { PermissionsReportsTab } from './PermissionsReportsTab';
import { AbsenteeismCausesDashboard } from '../Attendance/AbsenteeismCausesDashboard';

interface AcademicPermissionsMainProps {
  user: User;
  onNavigateToSchoolYear?: () => void;
  onNavigateToAttendance?: () => void;
}

export function AcademicPermissionsMain({
  user,
  onNavigateToSchoolYear,
  onNavigateToAttendance
}: AcademicPermissionsMainProps) {
  const [activeTab, setActiveTab] = useState<'registro' | 'historial' | 'reportes' | 'ausentismo'>('registro');
  const [yearConfig, setYearConfig] = useState<AcademicYearConfigRecord>(() => getStoredSchoolYearConfig());
  const [availableGroups, setAvailableGroups] = useState<SchoolGroupRecord[]>(() => {
    const yConfig = getStoredSchoolYearConfig();
    const localData = getLocalAcademicData();
    return generateGroupsFromYearConfig(yConfig, localData.groups);
  });
  const [teachers, setTeachers] = useState<TeacherRecord[]>(() => getLocalAcademicData().teachers);
  const [subjects, setSubjects] = useState<string[]>(() => getStoredSubjects());
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    const yConfig = getStoredSchoolYearConfig();
    const localData = getLocalAcademicData();
    const groups = generateGroupsFromYearConfig(yConfig, localData.groups);
    return groups[0]?.id || '';
  });

  useEffect(() => {
    const syncData = () => {
      const yConfig = getStoredSchoolYearConfig();
      setYearConfig(yConfig);

      const localData = getLocalAcademicData();
      const groups = generateGroupsFromYearConfig(yConfig, localData.groups);
      setAvailableGroups(groups);
      setTeachers(localData.teachers);
      setSubjects(getStoredSubjects());

      setSelectedGroupId(current => {
        if (!current || !groups.some(g => g.id === current)) {
          return groups[0]?.id || '';
        }
        return current;
      });
    };

    syncData();

    window.addEventListener('jp1_academic_data_updated', syncData);
    return () => {
      window.removeEventListener('jp1_academic_data_updated', syncData);
    };
  }, []);

  const schoolYear = yearConfig.year || new Date().getFullYear();

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Top Banner Header */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-5 sticky top-0 z-20 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-purple-700 text-white rounded-xl shadow-xs shrink-0">
              <FileCheck2 className="w-5 sm:w-6 h-5 sm:h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Permisos Académicos
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] tracking-wider uppercase border border-amber-200">
                  Estudiantil
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                I. E. Juan Pablo I • Vinculado a listas de estudiantes de Asistencia Estudiantil y Año Escolar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-xl text-xs font-bold border border-purple-200">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span>Año Activo: {schoolYear}</span>
            </div>

            {availableGroups.length === 0 && onNavigateToSchoolYear && (
              <button
                type="button"
                onClick={onNavigateToSchoolYear}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors shadow-2xs"
              >
                Configurar en Año Escolar
              </button>
            )}

            {onNavigateToAttendance && (
              <button
                type="button"
                onClick={onNavigateToAttendance}
                className="px-3 py-1.5 bg-slate-100 hover:bg-purple-100 text-purple-700 hover:text-purple-900 text-xs font-bold rounded-xl transition-colors border border-purple-200 shadow-2xs flex items-center gap-1.5"
                title="Ir a gestión e importación de listas en Asistencia Estudiantil"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Gestionar Listas en Asistencia</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="max-w-7xl mx-auto mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('registro')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shrink-0 whitespace-nowrap transition-all ${
              activeTab === 'registro'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Registro por Curso</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historial')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shrink-0 whitespace-nowrap transition-all ${
              activeTab === 'historial'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial y Búsqueda</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reportes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shrink-0 whitespace-nowrap transition-all ${
              activeTab === 'reportes'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileDown className="w-4 h-4" />
            <span>Informes y Reportes PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ausentismo')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shrink-0 whitespace-nowrap transition-all ${
              activeTab === 'ausentismo'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-300" />
            <span>Dashboard Ausentismo y Causas</span>
          </button>
        </div>
      </div>

      {/* Main Content View */}
      <div className="max-w-7xl mx-auto w-full p-3 sm:p-6 space-y-4 sm:space-y-6">
        {activeTab === 'registro' && (
          <PermissionRegisterTab
            user={user}
            schoolYear={schoolYear}
            yearConfig={yearConfig}
            availableGroups={availableGroups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
            onNavigateToAttendance={onNavigateToAttendance}
          />
        )}

        {activeTab === 'historial' && (
          <PermissionsListTab
            user={user}
            schoolYear={schoolYear}
            availableGroups={availableGroups}
          />
        )}

        {activeTab === 'reportes' && (
          <PermissionsReportsTab
            user={user}
            schoolYear={schoolYear}
            yearConfig={yearConfig}
            availableGroups={availableGroups}
          />
        )}

        {activeTab === 'ausentismo' && (
          <AbsenteeismCausesDashboard
            user={user}
            schoolYear={schoolYear}
            yearConfig={yearConfig}
            availableGroups={availableGroups}
            teachers={teachers}
            subjects={subjects}
            onNavigateToAttendanceRegister={onNavigateToAttendance}
            onNavigateToPermissionsRegister={() => setActiveTab('registro')}
          />
        )}
      </div>
    </div>
  );
}
