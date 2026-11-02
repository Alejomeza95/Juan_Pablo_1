import React, { useEffect, useState, useMemo } from "react";
import { User } from "firebase/auth";
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db, ADMIN_EMAIL, isSuperAdminEmail } from "../firebase";
import { InstitutionalDocument, SystemUserPermissions } from "../types";
import { 
  FilePlus, FileText, Trash2, ExternalLink, AlertCircle, Loader2, UploadCloud, 
  Edit2, Eye, Printer, X, Calendar, Clock, Tag, Search, Filter, Plus, Hash, Check, RotateCcw, Lock,
  BarChart3, TrendingDown, ShieldAlert
} from "lucide-react";
import { Agenda } from "./Agenda";
import { Schedules } from "./Schedules";

import { AcademicConfigMain } from "./ScheduleGenerator/AcademicConfigMain";
import { AcademicYearConfig } from "./AcademicYear/AcademicYearConfig";
import { AttendanceMain } from "./Attendance/AttendanceMain";
import { AcademicPermissionsMain } from "./AcademicPermissions/AcademicPermissionsMain";
import { UsersManagementMain } from "./UsersManagement/UsersManagementMain";
import { AbsenteeismCausesDashboard } from "./Attendance/AbsenteeismCausesDashboard";
import { 
  getStoredSchoolYearConfig, 
  getLocalAcademicData, 
  generateGroupsFromYearConfig, 
  getStoredSubjects 
} from "../utils/academicConfigService";
import { AcademicYearConfigRecord, SchoolGroupRecord, TeacherRecord } from "../types";

// Suggested standard tags for the school
export const SUGGESTED_TAGS = [
  "PEI",
  "Manual de Convivencia",
  "Circulares",
  "Formatos",
  "Actas",
  "Docentes",
  "Estudiantes",
  "Padres de Familia",
  "Normativa",
  "Evaluación",
  "Horarios",
  "Gobierno Escolar"
];

// Consistent colors for tags based on text
export const getTagBadgeStyle = (tag: string) => {
  const styles = [
    { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
    { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
    { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
    { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
    { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  ];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % styles.length;
  return styles[index];
};

export function Dashboard({ 
  user, 
  activeView = 'dashboard',
  onNavigateView,
  isAuthorized = false,
  permissions
}: { 
  user: any; 
  activeView?: 'dashboard' | 'documents' | 'agenda' | 'schedules' | 'generator' | 'schoolYear' | 'attendance' | 'academicPermissions' | 'users';
  onNavigateView?: (view: any) => void;
  isAuthorized?: boolean;
  permissions?: SystemUserPermissions;
}) {
  const [documents, setDocuments] = useState<InstitutionalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Edit Modal state
  const [editingDoc, setEditingDoc] = useState<InstitutionalDocument | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Search & Filter state for Documents
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // View/Print Modal state
  const [viewingDoc, setViewingDoc] = useState<InstitutionalDocument | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (viewingDoc && viewingDoc.fileData) {
      try {
        const parts = viewingDoc.fileData.split(';base64,');
        if (parts.length === 2) {
          const contentType = parts[0].split(':')[1] || viewingDoc.fileType || 'application/pdf';
          const byteCharacters = atob(parts[1]);
          const byteArrays = [];
          for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
              byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
          }
          const blob = new Blob(byteArrays, { type: contentType });
          const url = URL.createObjectURL(blob);
          setPdfPreviewUrl(url);
          
          return () => URL.revokeObjectURL(url);
        } else {
          setPdfPreviewUrl(viewingDoc.fileData);
        }
      } catch (err) {
        console.error("Error creating preview URL", err);
        setPdfPreviewUrl(viewingDoc.fileData);
      }
    } else {
      setPdfPreviewUrl(null);
    }
  }, [viewingDoc]);

  // Delete Modal state
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isSuperAdmin = isSuperAdminEmail(user.email);
  const isAdmin = isSuperAdmin || Boolean(isAuthorized);

  // Absenteeism Dashboard in Panel de Control
  const canAccessAbsenteeism = isSuperAdmin || (permissions?.absenteeismDashboard ?? true);
  const [dashboardSubTab, setDashboardSubTab] = useState<'ausentismo' | 'documentos'>('ausentismo');

  // Academic data for AbsenteeismCausesDashboard
  const [yearConfig] = useState<AcademicYearConfigRecord>(() => getStoredSchoolYearConfig());
  const [availableGroups] = useState<SchoolGroupRecord[]>(() => {
    const yConfig = getStoredSchoolYearConfig();
    const localData = getLocalAcademicData();
    return generateGroupsFromYearConfig(yConfig, localData.groups);
  });
  const [teachers] = useState<TeacherRecord[]>(() => getLocalAcademicData().teachers);
  const [subjects] = useState<string[]>(() => getStoredSubjects());

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "documents"), orderBy("uploadedAt", "desc"));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as InstitutionalDocument[];
        setDocuments(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Firestore error:", err);
        if (err.code === "permission-denied") {
          setError("Error de permisos: Las reglas de Firebase bloquean el acceso. Asegúrate de haber actualizado las reglas en la consola web de Firebase.");
        } else {
          setError(err.message);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim().replace(/^#/, '');
    if (!trimmed) return;
    if (!tags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      setTags([...tags, trimmed]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t.toLowerCase() !== tagToRemove.toLowerCase()));
  };

  const handleAddEditTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim().replace(/^#/, '');
    if (!trimmed) return;
    if (!editTags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      setEditTags([...editTags, trimmed]);
    }
    setEditTagInput("");
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(t => t.toLowerCase() !== tagToRemove.toLowerCase()));
  };

  // Dynamic set of all unique tags used across existing documents
  const allExistingTags = useMemo(() => {
    const set = new Set<string>();
    documents.forEach(doc => {
      if (Array.isArray(doc.tags)) {
        doc.tags.forEach(t => {
          if (t && t.trim()) set.add(t.trim());
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  // Filtered documents by search query and active tag filter
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Filter by tag if selected
      if (selectedTag) {
        if (!doc.tags || !doc.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())) {
          return false;
        }
      }
      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = doc.title.toLowerCase().includes(query);
        const matchesDesc = doc.description?.toLowerCase().includes(query) || false;
        const matchesFile = doc.fileName?.toLowerCase().includes(query) || false;
        const matchesTag = doc.tags?.some(t => t.toLowerCase().includes(query)) || false;
        return matchesTitle || matchesDesc || matchesFile || matchesTag;
      }
      return true;
    });
  }, [documents, selectedTag, searchQuery]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title || !isAdmin) return;

    if (file.size > 700 * 1024) { // Roughly 700KB limit before Base64 inflation
      alert("El archivo es demasiado grande para Firestore. El límite es de aproximadamente 700KB por archivo para mantenerse dentro del límite de 1MB de la base de datos.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      setUploadProgress(50);
      const base64Data = await fileToBase64(file);
      
      setUploadProgress(80);
      await addDoc(collection(db, "documents"), {
        title,
        description,
        fileName: file.name,
        fileData: base64Data,
        fileType: file.type || "application/octet-stream",
        uploadedAt: Date.now(),
        uploadedBy: user.email,
        tags: tags,
      });

      setUploadProgress(100);
      
      // Reset form
      setShowUploadModal(false);
      setTitle("");
      setDescription("");
      setFile(null);
      setTags([]);
      setTagInput("");
      setIsUploading(false);
    } catch (err: any) {
      console.error("Error saving document:", err);
      if (err.code === "permission-denied" || err.message?.includes("permission")) {
        alert("Error de permisos al subir: Asegúrate de haber actualizado las reglas de la base de datos de Firebase.");
      } else {
        alert("Error al subir el documento: " + err.message);
      }
      setIsUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!isAdmin || !documentToDelete) return;

    setIsDeleting(true);
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, "documents", documentToDelete));
      setDocumentToDelete(null);
    } catch (error: any) {
      console.error("Error deleting document:", error);
      alert("Error al eliminar: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc || !editTitle || !isAdmin) return;

    if (editFile && editFile.size > 700 * 1024) {
      alert("El nuevo archivo es demasiado grande para Firestore. El límite es de aproximadamente 700KB.");
      return;
    }

    setIsUpdating(true);
    try {
      const updateData: any = {
        title: editTitle,
        description: editDescription,
        tags: editTags,
      };

      if (editFile) {
        const base64Data = await fileToBase64(editFile);
        updateData.fileData = base64Data;
        updateData.fileName = editFile.name;
        updateData.fileType = editFile.type || "application/octet-stream";
      }

      await updateDoc(doc(db, "documents", editingDoc.id), updateData);
      setEditingDoc(null);
    } catch (error) {
      console.error("Error updating document:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const openEditModal = (doc: InstitutionalDocument) => {
    setEditingDoc(doc);
    setEditTitle(doc.title);
    setEditDescription(doc.description);
    setEditTags(Array.isArray(doc.tags) ? [...doc.tags] : []);
    setEditTagInput("");
    setEditFile(null);
  };

  return (
    <div className={`h-full ${(activeView === 'dashboard' || activeView === 'agenda' || activeView === 'generator' || activeView === 'schoolYear' || activeView === 'attendance' || activeView === 'academicPermissions' || activeView === 'users') ? 'p-0 flex flex-col min-h-0 flex-1 overflow-hidden' : 'p-3 sm:p-6 lg:p-8 flex flex-col gap-4 sm:gap-6'}`}>
      
      {activeView === 'attendance' ? (
        <AttendanceMain 
          user={user} 
          onNavigateToSchoolYear={() => onNavigateView && onNavigateView('schoolYear')} 
        />
      ) : activeView === 'academicPermissions' ? (
        (!permissions?.academicPermissions && !isSuperAdmin) ? (
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-slate-50">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full space-y-4">
              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">Acceso No Asignado a Permisos Académicos</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Tu cuenta institucional no tiene habilitada la casilla de <strong>Permisos Académicos</strong>. Si requieres acceso a este módulo, solicita a la Rectoría o Administrador del sistema que marque tu permiso en la <strong>Gestión de Usuarios</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateView && onNavigateView('attendance')}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors w-full"
              >
                Volver a Asistencia Estudiantil
              </button>
            </div>
          </div>
        ) : (
          <AcademicPermissionsMain
            user={user}
            onNavigateToSchoolYear={() => onNavigateView && onNavigateView('schoolYear')}
            onNavigateToAttendance={() => onNavigateView && onNavigateView('attendance')}
          />
        )
      ) : activeView === 'users' ? (
        <UsersManagementMain user={user} onNavigateView={onNavigateView} />
      ) : activeView === 'schoolYear' ? (
        <AcademicYearConfig user={user} />
      ) : activeView === 'generator' ? (
        <AcademicConfigMain user={user} />
      ) : activeView === 'schedules' ? (
        <Schedules user={user} />
      ) : activeView === 'agenda' ? (
        <Agenda user={user} />
      ) : activeView === 'documents' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-xl flex items-center gap-2">
                  <span>Biblioteca de Documentos</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Busca por texto, filtra por etiquetas y descarga la documentación oficial del colegio
                </p>
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setTags([]);
                  setTagInput("");
                  setShowUploadModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm self-start sm:self-auto hover:shadow-indigo-100"
              >
                <FilePlus className="w-4 h-4" />
                <span>Subir Nuevo Documento</span>
              </button>
            )}
          </div>

          {/* Search and Tag Filters Toolbar */}
          <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-200 mb-4 space-y-3 shrink-0">
            {/* Search Input Row */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por título, descripción, archivo o etiqueta..."
                  className="w-full pl-9 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Borrar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {(selectedTag || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedTag(null);
                    setSearchQuery("");
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200 text-xs font-bold transition-colors shrink-0 shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Limpiar filtros</span>
                </button>
              )}
            </div>

            {/* Tag Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
              <div className="flex items-center gap-1 text-slate-500 font-bold shrink-0 mr-1">
                <Filter className="w-3.5 h-3.5 text-indigo-500" />
                <span>Etiquetas:</span>
              </div>

              {/* All tags button */}
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-all shrink-0 border ${
                  selectedTag === null
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                Todas ({documents.length})
              </button>

              {/* Dynamic tag buttons */}
              {allExistingTags.map((tag) => {
                const count = documents.filter(d => Array.isArray(d.tags) && d.tags.some(t => t.toLowerCase() === tag.toLowerCase())).length;
                const isSelected = selectedTag?.toLowerCase() === tag.toLowerCase();
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(isSelected ? null : tag)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold text-xs transition-all shrink-0 border ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-indigo-50/70 hover:border-indigo-200 hover:text-indigo-800"
                    }`}
                  >
                    <Hash className={`w-3 h-3 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`} />
                    <span>{tag}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${
                      isSelected ? "bg-indigo-700 text-indigo-100" : "bg-slate-100 text-slate-500"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}

              {allExistingTags.length === 0 && (
                <span className="text-slate-400 text-xs italic">
                  No hay etiquetas creadas todavía. Crea etiquetas al subir o editar un documento.
                </span>
              )}
            </div>
          </div>

          {/* Active filter summary line */}
          {(selectedTag || searchQuery) && (
            <div className="flex items-center justify-between text-xs text-slate-500 mb-3 px-1">
              <span>
                Mostrando <strong>{filteredDocuments.length}</strong> de <strong>{documents.length}</strong> documentos
                {selectedTag && <> con la etiqueta <span className="text-indigo-600 font-bold">#{selectedTag}</span></>}
                {searchQuery && <> para <span className="text-slate-800 font-bold">"{searchQuery}"</span></>}
              </span>
            </div>
          )}
          
          {error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex flex-col items-center max-w-md">
                <AlertCircle className="w-8 h-8 mb-2 text-red-500" />
                <h3 className="font-bold text-sm mb-1">Error de conexión</h3>
                <p className="text-xs text-red-500/80">{error}</p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex-1 flex justify-center items-center">
              <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 p-8">
              <FileText className="h-16 w-16 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900">No hay documentos</h3>
              <p className="text-sm mt-2 max-w-sm">Aún no se han cargado documentos institucionales. Regresa más tarde.</p>
              {isAdmin && (
                <button
                  onClick={() => {
                    setTags([]);
                    setTagInput("");
                    setShowUploadModal(true);
                  }}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700 transition-colors"
                >
                  Subir el primer documento
                </button>
              )}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No se encontraron documentos</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Ningún documento coincide con los criterios de búsqueda o etiquetas seleccionadas.
              </p>
              <button
                onClick={() => {
                  setSelectedTag(null);
                  setSearchQuery("");
                }}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Restablecer todos los filtros
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 pb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 auto-rows-max">
              {filteredDocuments.map((doc) => (
                <div key={doc.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col hover:shadow-md transition-shadow group relative">
                  {/* Card top */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-2xs">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded-md">
                        {doc.fileType?.includes('pdf') ? 'PDF' : doc.fileType?.includes('word') || doc.fileName?.endsWith('.docx') ? 'Word' : doc.fileType?.includes('sheet') || doc.fileName?.endsWith('.xlsx') ? 'Excel' : 'Doc'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-slate-800 text-sm mb-1.5 line-clamp-2 leading-snug" title={doc.title}>
                    {doc.title}
                  </h3>

                  {/* Tags Badges */}
                  <div className="flex flex-wrap gap-1 mb-2.5 min-h-[22px]">
                    {doc.tags && doc.tags.length > 0 ? (
                      doc.tags.map((t) => {
                        const badgeStyle = getTagBadgeStyle(t);
                        const isFilterActive = selectedTag?.toLowerCase() === t.toLowerCase();
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setSelectedTag(isFilterActive ? null : t)}
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold border transition-all ${
                              isFilterActive
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                                : `${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} hover:opacity-80`
                            }`}
                            title={`Filtrar por etiqueta #${t}`}
                          >
                            <Hash className="w-2.5 h-2.5 opacity-60" />
                            <span>{t}</span>
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Sin etiquetas</span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-500 mb-4 line-clamp-3 flex-1" title={doc.description}>
                    {doc.description || "Sin descripción adicional"}
                  </p>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-200/60">
                    <button
                      onClick={() => setViewingDoc(doc)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Visualizar</span>
                    </button>
                    <a
                      href={doc.fileData}
                      download={doc.fileName || `${doc.title}.pdf`}
                      className="flex-shrink-0 flex items-center justify-center bg-white text-indigo-600 border border-slate-200 hover:bg-indigo-50 w-9 h-9 rounded-xl transition-colors shadow-2xs"
                      title="Descargar archivo"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => openEditModal(doc)}
                          className="flex-shrink-0 flex items-center justify-center bg-white text-slate-500 border border-slate-200 hover:text-indigo-600 hover:bg-indigo-50 w-9 h-9 rounded-xl transition-colors shadow-2xs"
                          title="Editar documento y etiquetas"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDocumentToDelete(doc.id)}
                          className="flex-shrink-0 flex items-center justify-center bg-white text-slate-500 border border-slate-200 hover:text-red-600 hover:bg-red-50 w-9 h-9 rounded-xl transition-colors shadow-2xs"
                          title="Eliminar documento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="h-full flex flex-col flex-1 min-h-0 overflow-hidden bg-slate-50">
          {/* Sub-barra de navegación del Panel de Control */}
          <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setDashboardSubTab('ausentismo')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  dashboardSubTab === 'ausentismo'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <span>Dashboard de Ausentismo y Alertas</span>
              </button>
              <button
                type="button"
                onClick={() => setDashboardSubTab('documentos')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  dashboardSubTab === 'documentos'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Documentos Recientes ({documents.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[11px]">
                <BarChart3 className="w-3.5 h-3.5" />
                Panel de Control Institucional
              </span>
            </div>
          </div>

          {/* Contenido de la pestaña activa en el Panel de Control */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {dashboardSubTab === 'ausentismo' ? (
              !canAccessAbsenteeism ? (
                <div className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-slate-50">
                  <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full space-y-4">
                    <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                      <Lock className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        Acceso Restringido al Dashboard de Ausentismo
                      </h3>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        Tu cuenta de usuario no tiene asignado el permiso para consultar el <strong>Dashboard de Ausentismo</strong> en el Panel de Control. Solicita a la Rectoría o Administrador que active esta casilla en la <strong>Gestión de Usuarios</strong>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDashboardSubTab('documentos')}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors w-full"
                    >
                      Ver Documentos Recientes
                    </button>
                  </div>
                </div>
              ) : (
                <AbsenteeismCausesDashboard
                  user={user}
                  schoolYear={yearConfig.activeYear || new Date().getFullYear()}
                  yearConfig={yearConfig}
                  availableGroups={availableGroups}
                  teachers={teachers}
                  subjects={subjects}
                  onNavigateToAttendanceRegister={() => onNavigateView && onNavigateView('attendance')}
                  onNavigateToPermissionsRegister={() => onNavigateView && onNavigateView('academicPermissions')}
                />
              )
            ) : (
              <div className="p-3 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 overflow-y-auto flex-1">
                {/* Document List Block */}
                <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-col min-h-[400px] ${isAdmin ? 'col-span-12 lg:col-span-8' : 'col-span-12'}`}>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-bold text-slate-900">Documentos Recientes</h2>
                  </div>
                  
                  {error ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                      <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex flex-col items-center max-w-md">
                        <AlertCircle className="w-8 h-8 mb-2 text-red-500" />
                        <h3 className="font-bold text-sm mb-1">Error de conexión</h3>
                        <p className="text-xs text-red-500/80">{error}</p>
                      </div>
                    </div>
                  ) : loading ? (
                    <div className="flex-1 flex justify-center items-center">
                      <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500">
                      <FileText className="h-12 w-12 text-slate-300 mb-4" />
                      <h3 className="text-sm font-medium text-slate-900">No hay documentos</h3>
                      <p className="text-xs mt-1">Aún no se han cargado documentos institucionales.</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                          <tr>
                            <th className="pb-3 font-semibold">Nombre del Archivo</th>
                            <th className="pb-3 font-semibold hidden sm:table-cell">Descripción</th>
                            <th className="pb-3 font-semibold">Fecha</th>
                            <th className="pb-3 font-semibold text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-50">
                          {documents.map((doc) => (
                            <tr key={doc.id} className="group hover:bg-slate-50 transition-colors">
                              <td className="py-4 font-medium text-slate-700">
                                <div className="flex items-start gap-3">
                                  <FileText className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                  <div className="flex flex-col">
                                    <span className="truncate max-w-[150px] sm:max-w-[250px] font-bold text-slate-800">{doc.title}</span>
                                    {doc.tags && doc.tags.length > 0 && (
                                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                                        {doc.tags.map(t => {
                                          const st = getTagBadgeStyle(t);
                                          return (
                                            <span key={t} className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold border ${st.bg} ${st.text} ${st.border}`}>
                                              #{t}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 text-slate-500 hidden sm:table-cell">
                                <span className="truncate block max-w-[200px]">{doc.description}</span>
                              </td>
                              <td className="py-4 text-slate-400 whitespace-nowrap">
                                {new Date(doc.uploadedAt).toLocaleDateString()}
                              </td>
                              <td className="py-4 text-right">
                                <div className="flex justify-end items-center gap-1">
                                    <button
                                      onClick={() => setViewingDoc(doc)}
                                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-block"
                                      title="Ver e Imprimir documento"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </button>
                                    <a
                                      href={doc.fileData}
                                      download={doc.fileName || `${doc.title}.pdf`}
                                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-block"
                                      title="Descargar documento"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                    {isAdmin && (
                                      <>
                                        <button 
                                          onClick={() => openEditModal(doc)}
                                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                          title="Editar documento"
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button 
                                          onClick={() => setDocumentToDelete(doc.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar documento"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Upload Block */}
                {isAdmin && (
                  <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">Subir Nuevo Documento</h3>
                    <p className="text-xs text-slate-500 mb-6 px-4">
                      Haz clic aquí para abrir el formulario de subida y añadir un nuevo archivo a la plataforma
                    </p>
                    <button 
                      onClick={() => setShowUploadModal(true)}
                      className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors"
                    >
                      Subir Documento
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-semibold text-gray-900">Subir nuevo documento</h3>
              <button 
                onClick={() => !isUploading && setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={isUploading}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isUploading}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  placeholder="Ej. Manual de Convivencia"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (Opcional)</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isUploading}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none text-sm"
                  placeholder="Breve descripción del contenido..."
                />
              </div>

              {/* Tags Section */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Etiquetas (Filtros de búsqueda)</span>
                  </span>
                  <span className="text-[11px] text-slate-400">Presiona Enter o Añadir</span>
                </label>
                
                {/* Active tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="hover:text-red-600 transition-colors ml-0.5"
                          title="Eliminar etiqueta"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Tag Input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          handleAddTag(tagInput);
                        }
                      }}
                      disabled={isUploading}
                      placeholder="Ej. PEI, Circular, Formatos, Docentes..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddTag(tagInput)}
                    disabled={!tagInput.trim() || isUploading}
                    className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-40"
                  >
                    Añadir
                  </button>
                </div>

                {/* Quick suggestions */}
                <div className="mt-2">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Sugerencias frecuentes:
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {SUGGESTED_TAGS.map((st) => {
                      const isAdded = tags.some((t) => t.toLowerCase() === st.toLowerCase());
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => isAdded ? handleRemoveTag(st) : handleAddTag(st)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors border ${
                            isAdded
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                              : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                          }`}
                        >
                          {isAdded ? `✓ #${st}` : `+ #${st}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Archivo</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-lg hover:border-indigo-500 transition-colors bg-slate-50">
                  <div className="space-y-1 text-center">
                    <UploadCloud className="mx-auto h-12 w-12 text-slate-400" />
                    <div className="flex text-sm text-slate-600 justify-center">
                      <label className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-1">
                        <span>Seleccionar archivo</span>
                        <input type="file" className="sr-only" onChange={handleFileChange} required disabled={isUploading} />
                      </label>
                    </div>
                    <p className="text-xs text-slate-500 pt-1">
                      {file ? file.name : "Cualquier formato de documento"}
                    </p>
                  </div>
                </div>
              </div>

              {isUploading && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Subiendo archivo...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploading}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !file}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-100"
                >
                  {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmar Subida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingDoc && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-semibold text-gray-900">Editar documento</h3>
              <button 
                onClick={() => !isUpdating && setEditingDoc(null)}
                className="text-gray-400 hover:text-gray-600"
                disabled={isUpdating}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={isUpdating}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  placeholder="Ej. Manual de Convivencia"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (Opcional)</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={isUpdating}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none text-sm"
                  placeholder="Breve descripción del contenido..."
                />
              </div>

              {/* Tags Section */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Etiquetas (Filtros de búsqueda)</span>
                  </span>
                  <span className="text-[11px] text-slate-400">Presiona Enter o Añadir</span>
                </label>
                
                {/* Active edit tags */}
                {editTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    {editTags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveEditTag(t)}
                          className="hover:text-red-600 transition-colors ml-0.5"
                          title="Eliminar etiqueta"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Tag Input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={editTagInput}
                      onChange={(e) => setEditTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          handleAddEditTag(editTagInput);
                        }
                      }}
                      disabled={isUpdating}
                      placeholder="Ej. PEI, Circular, Formatos, Docentes..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddEditTag(editTagInput)}
                    disabled={!editTagInput.trim() || isUpdating}
                    className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-40"
                  >
                    Añadir
                  </button>
                </div>

                {/* Quick suggestions */}
                <div className="mt-2">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Sugerencias frecuentes:
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {SUGGESTED_TAGS.map((st) => {
                      const isAdded = editTags.some((t) => t.toLowerCase() === st.toLowerCase());
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => isAdded ? handleRemoveEditTag(st) : handleAddEditTag(st)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors border ${
                            isAdded
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                              : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                          }`}
                        >
                          {isAdded ? `✓ #${st}` : `+ #${st}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reemplazar Archivo (Opcional)</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg hover:border-indigo-400 transition-colors bg-slate-50">
                  <div className="space-y-1 text-center">
                    <UploadCloud className="mx-auto h-10 w-10 text-slate-400" />
                    <div className="flex justify-center text-sm text-slate-600">
                      <label className="relative cursor-pointer bg-transparent rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                        <span>{editFile ? editFile.name : "Seleccionar nuevo archivo"}</span>
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(e) => setEditFile(e.target.files ? e.target.files[0] : null)}
                          disabled={isUpdating}
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                        />
                      </label>
                    </div>
                    <p className="text-xs text-slate-500">
                      {editFile ? "Archivo listo para reemplazar" : "Si no seleccionas nada, se conservará el actual"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  disabled={isUpdating}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-100"
                >
                  {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {documentToDelete && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-500 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">¿Eliminar documento?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Esta acción no se puede deshacer. El documento será eliminado permanentemente.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => !isDeleting && setDocumentToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 flex-1 shadow-md shadow-red-100"
              >
                {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View & Print Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                {viewingDoc.title}
              </h3>
              <button onClick={() => setViewingDoc(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 p-4 overflow-hidden flex flex-col md:flex-row gap-4 bg-slate-100">
              {/* Controls Sidebar */}
              <div className="w-full md:w-72 bg-white p-5 rounded-xl border border-slate-200 flex flex-col gap-5 shadow-sm">
                 <div>
                   <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                     <Printer className="w-5 h-5 text-indigo-500" /> 
                     Opciones de Impresión
                   </h4>
                   <p className="text-sm text-slate-600 mb-3">
                     Al hacer clic en el botón de abajo, se abrirá la ventana de impresión de tu sistema, donde podrás elegir:
                   </p>
                   <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1 mb-4">
                     <li>Tamaño: <b>Carta</b> u <b>Oficio (Legal)</b></li>
                     <li>Páginas: <b>Todas, pares, impares</b> o un rango.</li>
                   </ul>
                 </div>
                 
                 <button 
                   onClick={() => {
                     const iframe = document.getElementById('pdf-print-frame') as HTMLIFrameElement;
                     if(iframe && iframe.contentWindow) {
                       iframe.contentWindow.print();
                     }
                   }}
                   className="mt-auto w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 transition-all"
                 >
                   <Printer className="w-5 h-5" />
                   Abrir Impresora
                 </button>
              </div>

               {/* Viewer Area */}
              <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                 {(viewingDoc.fileName && viewingDoc.fileName.toLowerCase().endsWith('.pdf')) || (viewingDoc.fileType && viewingDoc.fileType.includes('pdf')) ? (
                   pdfPreviewUrl ? (
                     <iframe 
                       id="pdf-print-frame"
                       src={pdfPreviewUrl} 
                       className="w-full h-full border-0"
                       title="PDF Viewer"
                     />
                   ) : (
                     <div className="flex flex-col items-center justify-center h-full text-slate-500">
                       <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                       <p className="text-sm">Cargando vista previa...</p>
                     </div>
                   )
                 ) : (
                   <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                     <FileText className="w-20 h-20 mb-6 text-slate-300" />
                     <h3 className="text-xl font-bold text-slate-700 mb-2">Vista previa no disponible</h3>
                     <p className="max-w-md mx-auto mb-6">
                       La vista previa y las opciones de impresión integradas solo están disponibles para archivos PDF.
                     </p>
                     <a 
                       href={viewingDoc.fileData} 
                       download={viewingDoc.fileName || viewingDoc.title} 
                       className="inline-flex items-center gap-2 bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 py-2 px-6 rounded-xl font-semibold transition-colors"
                     >
                       <ExternalLink className="w-4 h-4" />
                       Descargar archivo para imprimir
                     </a>
                   </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
