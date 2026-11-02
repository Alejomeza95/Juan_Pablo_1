import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  Calendar, 
  Check, 
  Save, 
  Layers, 
  RotateCcw, 
  AlertCircle,
  Hash,
  Users
} from 'lucide-react';
import { 
  AcademicYearConfigRecord, 
  GradeConfigItem,
  EducationalLevelKey
} from '../../types';
import { 
  getStoredSchoolYearConfig, 
  saveStoredSchoolYearConfig, 
  getDefaultSchoolYearConfig,
  DEFAULT_SECTIONS
} from '../../utils/academicConfigService';

interface AcademicYearConfigProps {
  user: User;
}

export function AcademicYearConfig({ user }: AcademicYearConfigProps) {
  const [config, setConfig] = useState<AcademicYearConfigRecord>(getStoredSchoolYearConfig());
  const [yearInput, setYearInput] = useState<string>(String(config.year || new Date().getFullYear()));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load stored config on mount
  useEffect(() => {
    const loaded = getStoredSchoolYearConfig();
    setConfig(loaded);
    setYearInput(String(loaded.year || new Date().getFullYear()));
  }, []);

  // Update Year in state whenever input changes
  const handleYearChange = (val: string) => {
    setYearInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 1900 && parsed < 2100) {
      setConfig(prev => ({
        ...prev,
        year: parsed,
        id: `year_${parsed}`,
        displayName: `Año Escolar ${parsed}`
      }));
    }
  };

  // Toggle selection of a grade
  const handleToggleGrade = (levelKey: EducationalLevelKey, gradeId: string) => {
    setConfig(prev => ({
      ...prev,
      levels: prev.levels.map(level => {
        if (level.key !== levelKey) return level;
        return {
          ...level,
          grades: level.grades.map(grade => {
            if (grade.id !== gradeId) return grade;
            const newSelected = !grade.selected;
            return {
              ...grade,
              selected: newSelected,
              // If selected and has 0 groups, default to 1 group
              groupsCount: newSelected ? Math.max(1, grade.groupsCount || 1) : grade.groupsCount
            };
          })
        };
      })
    }));
  };

  // Change how many groups/sections a grade has
  const handleGroupsCountChange = (levelKey: EducationalLevelKey, gradeId: string, count: number) => {
    const validCount = Math.max(1, Math.min(12, count));
    const generatedSections = DEFAULT_SECTIONS.slice(0, validCount);
    if (generatedSections.length < validCount) {
      for (let i = generatedSections.length; i < validCount; i++) {
        generatedSections.push(String.fromCharCode(65 + i));
      }
    }

    setConfig(prev => ({
      ...prev,
      levels: prev.levels.map(level => {
        if (level.key !== levelKey) return level;
        return {
          ...level,
          grades: level.grades.map(grade => {
            if (grade.id !== gradeId) return grade;
            return {
              ...grade,
              groupsCount: validCount,
              sections: generatedSections
            };
          })
        };
      })
    }));
  };

  // Quick select/unselect all grades in a level
  const handleToggleAllInLevel = (levelKey: EducationalLevelKey, selectAll: boolean) => {
    setConfig(prev => ({
      ...prev,
      levels: prev.levels.map(level => {
        if (level.key !== levelKey) return level;
        return {
          ...level,
          grades: level.grades.map(grade => ({
            ...grade,
            selected: selectAll
          }))
        };
      })
    }));
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const yearNumber = parseInt(yearInput, 10) || config.year || new Date().getFullYear();
      const payload: AcademicYearConfigRecord = {
        ...config,
        year: yearNumber,
        id: `year_${yearNumber}`,
        displayName: `Año Escolar ${yearNumber}`,
        updatedAt: Date.now(),
        updatedBy: user.email || 'admin'
      };

      await saveStoredSchoolYearConfig(payload);
      setConfig(payload);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 4000);
    } catch (err: any) {
      console.error("Error saving school year config:", err);
      setSaveError(err.message || 'Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default standard grades
  const handleResetDefaults = () => {
    if (window.confirm("¿Deseas restablecer los grados y niveles a la configuración inicial sugerida?")) {
      const yearNumber = parseInt(yearInput, 10) || new Date().getFullYear();
      const def = getDefaultSchoolYearConfig(yearNumber);
      setConfig(def);
    }
  };

  // Summary counts
  const totalSelectedGrades = config.levels.reduce((acc, lvl) => 
    acc + lvl.grades.filter(g => g.selected).length, 0
  );

  const totalGroups = config.levels.reduce((acc, lvl) => 
    acc + lvl.grades.filter(g => g.selected).reduce((gAcc, g) => gAcc + (g.groupsCount || 1), 0), 0
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 sticky top-0 z-20 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-5xl mx-auto">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Año Escolar
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Edita el año escolar, selecciona los grados existentes y especifica cuántos grupos tiene cada uno.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 rounded-xl text-xs font-bold transition-all"
              title="Restablecer valores predeterminados"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Restablecer</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-indigo-100 transition-all active:scale-[0.98]"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>{isSaving ? "Guardando..." : "Guardar Año Escolar"}</span>
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {saveSuccess && (
          <div className="mt-4 max-w-5xl mx-auto p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-emerald-950">
                  ¡Año Escolar {yearInput} guardado y sincronizado con Configuración Académica!
                </p>
                <p className="text-xs text-emerald-800 font-normal mt-0.5">
                  Se actualizaron <strong>{totalGroups} grupos escolares</strong> ({totalSelectedGrades} grados). Ya están disponibles automáticamente en el módulo de Docentes para asignaciones académicas.
                </p>
              </div>
            </div>
            <button 
              onClick={() => setSaveSuccess(false)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold ml-2 p-1 rounded"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error Alert */}
        {saveError && (
          <div className="mt-4 max-w-5xl mx-auto p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}
      </div>

      {/* Main Body */}
      <div className="max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6 flex-1">
        
        {/* Editable School Year Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Año Escolar Lectivo (Editable) *
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="relative max-w-xs w-full">
                  <input
                    type="number"
                    min="2020"
                    max="2040"
                    value={yearInput}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border-2 border-indigo-200 focus:border-indigo-600 focus:bg-white rounded-xl text-xl font-black text-indigo-900 tracking-wide outline-none transition-all"
                    placeholder="Ej. 2026"
                  />
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  Escribe el año lectivo que deseas configurar (ej. 2026, 2027)
                </span>
              </div>
            </div>

            {/* Quick summary counters */}
            <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-6 shrink-0">
              <div className="text-center px-3">
                <span className="block text-2xl font-black text-slate-900">{totalSelectedGrades}</span>
                <span className="text-[11px] font-bold text-slate-500 uppercase">Grados seleccionados</span>
              </div>
              <div className="h-8 w-[1px] bg-slate-200" />
              <div className="text-center px-3">
                <span className="block text-2xl font-black text-indigo-600">{totalGroups}</span>
                <span className="text-[11px] font-bold text-slate-500 uppercase">Grupos en total</span>
              </div>
            </div>
          </div>
        </div>

        {/* Educational Levels List: Select Grade + How Many Groups */}
        <div className="space-y-5">
          {config.levels.map((level) => {
            const activeGradesCount = level.grades.filter(g => g.selected).length;
            const allSelected = level.grades.length > 0 && activeGradesCount === level.grades.length;

            return (
              <div 
                key={level.key}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs"
              >
                {/* Level Title Bar */}
                <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h2 className="font-bold text-slate-900 text-base">
                        {level.name}
                      </h2>
                      <span className="text-xs text-slate-500">
                        {level.subtitle} • {activeGradesCount} de {level.grades.length} grados seleccionados
                      </span>
                    </div>
                  </div>

                  {/* Toggle all in level */}
                  <button
                    type="button"
                    onClick={() => handleToggleAllInLevel(level.key, !allSelected)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline px-2 py-1 rounded"
                  >
                    {allSelected ? "Desmarcar todos" : "Seleccionar todos"}
                  </button>
                </div>

                {/* Table of Grades */}
                <div className="divide-y divide-slate-100">
                  {level.grades.map((grade) => {
                    const isSelected = grade.selected;
                    const groupsCount = grade.groupsCount || 1;
                    const previewSections = (grade.sections && grade.sections.length > 0)
                      ? grade.sections
                      : DEFAULT_SECTIONS.slice(0, groupsCount);

                    return (
                      <div 
                        key={grade.id}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          isSelected ? 'bg-indigo-50/20' : 'bg-white hover:bg-slate-50/50'
                        }`}
                      >
                        {/* Checkbox + Grade Name */}
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          <label className="relative flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleGrade(level.key, grade.id)}
                              className="sr-only peer"
                            />
                            <div className="w-5 h-5 border-2 border-slate-300 rounded-md peer-checked:bg-indigo-600 peer-checked:border-indigo-600 flex items-center justify-center transition-all">
                              {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                            </div>
                          </label>

                          <div 
                            className="cursor-pointer"
                            onClick={() => handleToggleGrade(level.key, grade.id)}
                          >
                            <span className={`text-sm font-bold block ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                              {grade.name}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {isSelected ? "Grado activo en este año escolar" : "No seleccionado"}
                            </span>
                          </div>
                        </div>

                        {/* How Many Groups (cuántos tiene) */}
                        <div className="flex items-center gap-3 sm:justify-end">
                          {isSelected ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                                ¿Cuántos grupos tiene?
                              </span>
                              
                              {/* Counter Buttons & Input */}
                              <div className="flex items-center bg-white border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleGroupsCountChange(level.key, grade.id, groupsCount - 1)}
                                  disabled={groupsCount <= 1}
                                  className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold text-sm disabled:opacity-30 disabled:hover:bg-white"
                                  title="Disminuir grupos"
                                >
                                  -
                                </button>

                                <input
                                  type="number"
                                  min="1"
                                  max="12"
                                  value={groupsCount}
                                  onChange={(e) => handleGroupsCountChange(level.key, grade.id, parseInt(e.target.value, 10) || 1)}
                                  className="w-12 h-8 text-center text-sm font-black text-slate-900 bg-transparent border-x border-slate-200 outline-none"
                                />

                                <button
                                  type="button"
                                  onClick={() => handleGroupsCountChange(level.key, grade.id, groupsCount + 1)}
                                  disabled={groupsCount >= 10}
                                  className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold text-sm disabled:opacity-30 disabled:hover:bg-white"
                                  title="Aumentar grupos"
                                >
                                  +
                                </button>
                              </div>

                              {/* Groups tags preview (e.g. 6°A, 6°B) */}
                              <div className="hidden md:flex items-center gap-1 pl-2">
                                {previewSections.map(sec => (
                                  <span 
                                    key={sec}
                                    className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200"
                                  >
                                    {grade.shortName ? `${grade.shortName}${sec}` : sec}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Marca la casilla para habilitar grupos
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Save Action Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-600">
            Año escolar a guardar: <strong className="text-indigo-600 text-sm font-bold">{yearInput}</strong> • Total de <strong className="text-slate-900 font-bold">{totalSelectedGrades} grados</strong> con <strong className="text-slate-900 font-bold">{totalGroups} grupos</strong> habilitados.
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm shadow-indigo-100 transition-all active:scale-[0.98]"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Guardando..." : "Guardar Configuración"}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
