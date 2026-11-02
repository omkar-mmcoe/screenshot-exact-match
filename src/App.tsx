import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Settings,
  Printer,
  GraduationCap,
  Users,
  DoorOpen,
  Layers,
  Search,
  ShieldCheck,
  FileSpreadsheet,
  Info,
  X,
  Dices,
  Send,
  Building2,
  Workflow,
  Sparkles,
  ChevronRight,
  Link as LinkIcon,
  Coffee,
  Trash2,
  Plus,
  BookOpen,
} from 'lucide-react';
import {
  Institution,
  Department,
  Semester,
  Division,
  Faculty,
  Room,
  Subject,
  SubjectOffering,
  SlotConfig,
  RoomReservation,
  SimulateResponse,
  PublishedSchedule,
  GridCell,
  DivisionGrid,
  TeachingAssignment,
  PrecheckResult,
  fetchInstitutions,
  fetchDepartments,
  fetchSemesters,
  fetchDivisions,
  fetchFaculty,
  fetchRooms,
  fetchSubjects,
  fetchOfferings,
  fetchEligibleFaculty,
  createAssignment,
  deleteAssignment,
  createOffering,
  deleteOffering,
  createDivision,
  createRoomReservation,
  deleteRoomReservation,
  fetchSlotConfigs,
  fetchRoomReservations,
  fetchAssignments,
  fetchPublished,
  fetchTimetable,
  runPrecheck,
  runSimulate,
  publishSchedule,
  fetchExportCsv,
  healthCheck,
  downloadCsvFile,
  formatTimeRange,
  DAY_NAMES,
  ApiError,
} from './lib';

// ─── Toast System Types ────────────────────────────────────────────────────────

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

// ─── Main Application Component ────────────────────────────────────────────────

export default function App() {
  // Navigation: Overview, Generate, Master, Faculty, Class, Settings
  const [activeTab, setActiveTab] = useState<'overview' | 'generate' | 'master' | 'faculty' | 'class' | 'settings'>('overview');

  // Backend Connectivity
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Cascading Academic Scope State
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<string>('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemId, setSelectedSemId] = useState<string>('');

  // Authoritative SQLite Metadata
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [roomsList, setRoomsList] = useState<Room[]>([]);
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [offeringsList, setOfferingsList] = useState<SubjectOffering[]>([]);
  const [slotConfigs, setSlotConfigs] = useState<SlotConfig[]>([]);
  const [roomReservations, setRoomReservations] = useState<RoomReservation[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);

  // Settings Sub-Tabs & Forms
  const [settingsSubTab, setSettingsSubTab] = useState<'assign' | 'offerings' | 'classes' | 'faculty' | 'rooms' | 'slots'>('assign');
  const [newAsgnDivisionId, setNewAsgnDivisionId] = useState<string>('');
  const [newAsgnOfferingId, setNewAsgnOfferingId] = useState<string>('');
  const [newAsgnScope, setNewAsgnScope] = useState<string>('division');
  const [newAsgnFacultyId, setNewAsgnFacultyId] = useState<string>('');
  const [eligibleFacultyList, setEligibleFacultyList] = useState<Faculty[]>([]);

  const [newOffSubjectId, setNewOffSubjectId] = useState<string>('');
  const [newOffHours, setNewOffHours] = useState<number>(3);
  const [newOffReqLab, setNewOffReqLab] = useState<boolean>(false);
  const [newOffLabSpec, setNewOffLabSpec] = useState<string>('');

  const [newDivCode, setNewDivCode] = useState<string>('');
  const [newDivName, setNewDivName] = useState<string>('');
  const [newDivCapacity, setNewDivCapacity] = useState<number>(60);

  const [newResRoomId, setNewResRoomId] = useState<string>('');
  const [newResDivId, setNewResDivId] = useState<string>('');
  const [newResSubjectId, setNewResSubjectId] = useState<string>('');
  const [newResReason, setNewResReason] = useState<string>('');
  const [newResExclusive, setNewResExclusive] = useState<boolean>(true);

  // Timetable & Generation State
  const [simulationResult, setSimulationResult] = useState<SimulateResponse | null>(null);
  const [publishedInfo, setPublishedInfo] = useState<PublishedSchedule | null>(null);
  const [activeTimetable, setActiveTimetable] = useState<DivisionGrid[]>([]);
  const [precheckResult, setPrecheckResult] = useState<PrecheckResult | null>(null);
  const [isPrechecking, setIsPrechecking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [solverChoice, setSolverChoice] = useState<'cpsat' | 'csp'>('cpsat');
  const [timeLimitMs, setTimeLimitMs] = useState<number>(30000);
  const [randomSeed, setRandomSeed] = useState<number>(() => Math.floor(Math.random() * 90000) + 10000);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Request race-condition guard
  const activeSemesterRequestId = useRef<string>('');
  const generationTimerRef = useRef<number | null>(null);

  // Filter & Inspection States
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('');
  const [masterSearch, setMasterSearch] = useState<string>('');
  const [masterKindFilter, setMasterKindFilter] = useState<'all' | 'theory' | 'practical'>('all');
  const [masterDivisionFilter, setMasterDivisionFilter] = useState<string>('all');
  const [selectedCellDetail, setSelectedCellDetail] = useState<{
    cell: GridCell;
    dayName: string;
    divisionName: string;
    slotLabel: string;
  } | null>(null);

  // Toast System
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (generationTimerRef.current) {
        clearInterval(generationTimerRef.current);
      }
    };
  }, []);

  // ─── Backend Connectivity ───────────────────────────────────────────────────

  const checkConnectivity = useCallback(async () => {
    try {
      await healthCheck();
      setBackendOnline(true);
      setBackendError(null);
    } catch (err) {
      setBackendOnline(false);
      const msg = err instanceof ApiError ? err.message : 'Backend unreachable';
      setBackendError(msg);
    }
  }, []);

  useEffect(() => {
    checkConnectivity();
  }, [checkConnectivity]);

  // Load Institutions
  useEffect(() => {
    if (backendOnline === false) return;
    fetchInstitutions()
      .then((data) => {
        setInstitutions(data);
        if (data.length > 0 && !selectedInstId) {
          setSelectedInstId(data[0].id);
        }
      })
      .catch((err) => {
        setBackendOnline(false);
        setBackendError(err.message);
      });
  }, [backendOnline, selectedInstId]);

  // Cascade: Institution -> Departments (clear dependent state on change)
  useEffect(() => {
    if (!selectedInstId) {
      setDepartments([]);
      setSelectedDeptId('');
      setSemesters([]);
      setSelectedSemId('');
      return;
    }
    fetchDepartments(selectedInstId)
      .then((data) => {
        setDepartments(data);
        if (data.length > 0) {
          setSelectedDeptId(data[0].id);
        } else {
          setSelectedDeptId('');
        }
      })
      .catch((err) => {
        showToast('error', 'Failed to load departments', err.message);
      });
  }, [selectedInstId, showToast]);

  // Cascade: Department -> Semesters (clear dependent state on change)
  useEffect(() => {
    if (!selectedDeptId) {
      setSemesters([]);
      setSelectedSemId('');
      return;
    }
    fetchSemesters(selectedDeptId)
      .then((data) => {
        setSemesters(data);
        if (data.length > 0) {
          // Select first valid semester returned by backend
          setSelectedSemId(data[0].id);
        } else {
          setSelectedSemId('');
        }
      })
      .catch((err) => {
        showToast('error', 'Failed to load semesters', err.message);
      });
  }, [selectedDeptId, showToast]);

  // Load Global Institutional Metadata (Faculty, Rooms, Reservations, Subjects)
  useEffect(() => {
    if (backendOnline === false) return;
    Promise.all([fetchFaculty(), fetchRooms(), fetchRoomReservations(), fetchSubjects()])
      .then(([facs, rms, res, subjs]) => {
        setFacultyList(facs);
        if (facs.length > 0 && !selectedFacultyId) {
          setSelectedFacultyId(facs[0].id);
        }
        setRoomsList(rms);
        if (rms.length > 0 && !newResRoomId) {
          setNewResRoomId(rms[0].id);
        }
        setRoomReservations(res);
        setSubjectsList(subjs);
        if (subjs.length > 0 && !newOffSubjectId) {
          setNewOffSubjectId(subjs[0].id);
        }
      })
      .catch((err) => {
        console.error('Error fetching institutional metadata:', err);
      });
  }, [backendOnline, selectedFacultyId, newResRoomId, newOffSubjectId]);

  // Scope Metadata: Load fresh data for selected semester and clear stale state
  const loadSemesterData = useCallback(
    async (semId: string) => {
      if (!semId) return;

      // Invalidate previous requests to prevent race conditions
      const currentReqId = Math.random().toString(36).slice(2, 9);
      activeSemesterRequestId.current = currentReqId;

      // Clear previous semester-specific state to prevent stale data
      setDivisions([]);
      setSlotConfigs([]);
      setAssignments([]);
      setOfferingsList([]);
      setActiveTimetable([]);
      setSimulationResult(null);
      setPrecheckResult(null);
      setPublishedInfo(null);

      try {
        const [divs, slots, assns, offs, pub, tt] = await Promise.all([
          fetchDivisions(semId),
          fetchSlotConfigs(semId),
          fetchAssignments(semId),
          fetchOfferings(semId).catch(() => []),
          fetchPublished(semId).catch(() => ({ published: false, schedule: null })),
          fetchTimetable(semId).catch(() => null),
        ]);

        // If user changed semester while request was in-flight, discard stale result
        if (activeSemesterRequestId.current !== currentReqId) return;

        setDivisions(divs);
        if (divs.length > 0) {
          setSelectedDivisionId(divs[0].id);
          setNewAsgnDivisionId(divs[0].id);
        }
        setSlotConfigs(slots);
        setAssignments(assns);
        setOfferingsList(offs);
        if (offs.length > 0) {
          setNewAsgnOfferingId(offs[0].id);
        }
        setPublishedInfo(pub);

        if (tt && tt.divisions && tt.divisions.length > 0) {
          setActiveTimetable(tt.divisions);
        }
      } catch (err) {
        if (activeSemesterRequestId.current === currentReqId) {
          console.warn('Error loading semester-specific data:', err);
        }
      }
    },
    [],
  );

  // Update eligible faculty list when selected offering changes
  useEffect(() => {
    if (!newAsgnOfferingId) {
      setEligibleFacultyList([]);
      return;
    }
    const off = offeringsList.find((o) => o.id === newAsgnOfferingId);
    if (!off) return;
    fetchEligibleFaculty(off.subject_id)
      .then((facs) => {
        setEligibleFacultyList(facs);
        if (facs.length > 0) {
          setNewAsgnFacultyId(facs[0].id);
        }
      })
      .catch(() => {
        setEligibleFacultyList(facultyList);
        if (facultyList.length > 0) {
          setNewAsgnFacultyId(facultyList[0].id);
        }
      });
  }, [newAsgnOfferingId, offeringsList, facultyList]);

  // Management CRUD Operations (Commit directly to SQLite)
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSemId || !newAsgnOfferingId || !newAsgnFacultyId) return;
    try {
      const isBatch = newAsgnScope !== 'division';
      await createAssignment(selectedSemId, {
        subject_offering_id: newAsgnOfferingId,
        faculty_id: newAsgnFacultyId,
        division_id: isBatch ? null : newAsgnDivisionId,
        batch_id: isBatch ? newAsgnScope : null,
      });
      showToast('success', 'Assignment Saved', 'Teaching assignment committed to SQLite database.');
      const updated = await fetchAssignments(selectedSemId);
      setAssignments(updated);
    } catch (err) {
      showToast('error', 'Failed to save assignment', err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!window.confirm('Delete this teaching assignment from database?')) return;
    try {
      await deleteAssignment(id);
      showToast('info', 'Assignment Deleted', 'Removed from database.');
      if (selectedSemId) {
        const updated = await fetchAssignments(selectedSemId);
        setAssignments(updated);
      }
    } catch (err) {
      showToast('error', 'Delete Failed', err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSemId || !newOffSubjectId) return;
    try {
      await createOffering(selectedSemId, {
        subject_id: newOffSubjectId,
        hours_per_week: Number(newOffHours),
        requires_lab: Boolean(newOffReqLab),
        lab_specialization: newOffLabSpec || null,
      });
      showToast('success', 'Offering Added', 'Subject offering committed to SQLite database.');
      const updated = await fetchOfferings(selectedSemId);
      setOfferingsList(updated);
      if (updated.length > 0 && !newAsgnOfferingId) {
        setNewAsgnOfferingId(updated[0].id);
      }
    } catch (err) {
      showToast('error', 'Failed to add offering', err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteOffering = async (id: string) => {
    if (!window.confirm('Delete this semester offering from database?')) return;
    try {
      if (selectedSemId) {
        await deleteOffering(selectedSemId, id);
        showToast('info', 'Offering Deleted', 'Removed from database.');
        const updated = await fetchOfferings(selectedSemId);
        setOfferingsList(updated);
      }
    } catch (err) {
      showToast('error', 'Delete Failed', err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSemId || !newDivCode) return;
    try {
      await createDivision(selectedSemId, {
        code: newDivCode,
        display_name: newDivName || newDivCode,
        student_count: Number(newDivCapacity),
        batches: [
          { code: 'A', student_count: Math.floor(newDivCapacity / 3) },
          { code: 'B', student_count: Math.floor(newDivCapacity / 3) },
          { code: 'C', student_count: newDivCapacity - 2 * Math.floor(newDivCapacity / 3) },
        ],
      });
      showToast('success', 'Class Created', `Division ${newDivCode} with 3 batches committed to SQLite.`);
      setNewDivCode('');
      setNewDivName('');
      const updated = await fetchDivisions(selectedSemId);
      setDivisions(updated);
    } catch (err) {
      showToast('error', 'Failed to create division', err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateRoomReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResRoomId) return;
    try {
      await createRoomReservation({
        room_id: newResRoomId,
        division_id: newResDivId || null,
        subject_id: newResSubjectId || null,
        reason: newResReason || 'Designated departmental policy',
        is_exclusive: newResExclusive ? 1 : 0,
      });
      showToast('success', 'Reservation Added', 'Protected room reservation active in database.');
      const updated = await fetchRoomReservations();
      setRoomReservations(updated);
      setNewResReason('');
    } catch (err) {
      showToast('error', 'Failed to add reservation', err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteRoomReservation = async (resId: string) => {
    if (!window.confirm('Delete this room reservation policy from database?')) return;
    try {
      await deleteRoomReservation(resId);
      showToast('info', 'Reservation Removed', 'Policy deleted from database.');
      const updated = await fetchRoomReservations();
      setRoomReservations(updated);
    } catch (err) {
      showToast('error', 'Delete Failed', err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (selectedSemId) {
      loadSemesterData(selectedSemId);
    }
  }, [selectedSemId, loadSemesterData]);

  // ─── Feasibility Precheck ───────────────────────────────────────────────────

  const handleRunPrecheck = async () => {
    if (!selectedSemId || isPrechecking) return;
    setIsPrechecking(true);
    try {
      const res = await runPrecheck(selectedSemId);
      setPrecheckResult(res);
      if (res.passed) {
        showToast('success', 'Precheck Passed', 'All period demands and faculty workloads are feasible.');
      } else {
        showToast('error', 'Precheck Failed', `${res.failures.length} capacity or workload deficits detected.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Precheck error';
      showToast('error', 'Precheck Request Failed', msg);
    } finally {
      setIsPrechecking(false);
    }
  };

  // ─── Timetable Generation Operation ─────────────────────────────────────────

  const handleGenerate = async () => {
    if (!selectedSemId || isGenerating) return;

    setIsGenerating(true);
    setElapsedMs(0);
    const startTs = Date.now();
    generationTimerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startTs);
    }, 50);

    const nextSeed = Math.floor(Math.random() * 90000) + 10000;
    setRandomSeed(nextSeed);

    try {
      const res = await runSimulate(selectedSemId, solverChoice, timeLimitMs, nextSeed);
      if (generationTimerRef.current) {
        clearInterval(generationTimerRef.current);
        generationTimerRef.current = null;
      }
      setElapsedMs(Date.now() - startTs);

      setSimulationResult(res);
      if (res.precheck) {
        setPrecheckResult(res.precheck);
      }

      if (res.precheck && !res.precheck.passed) {
        showToast(
          'error',
          'Precheck Feasibility Failed',
          `${res.precheck.failures.length} constraint conflicts prevent solving.`,
        );
        return;
      }

      if (res.timetable && res.timetable.divisions && res.timetable.divisions.length > 0) {
        setActiveTimetable(res.timetable.divisions);
      }

      if (res.validation && !res.validation.valid) {
        showToast(
          'error',
          'Validation Failed',
          `${res.validation.total_violations} hard constraint violations identified.`,
        );
      } else if (res.solver && res.solver.status === 'OPTIMAL') {
        showToast(
          'success',
          'Optimal Schedule Solved',
          `Solved in ${res.solver.runtime_ms.toFixed(0)} ms (Run ID: ${res.run_id?.slice(0, 12)}).`,
        );
      } else if (res.solver && res.solver.status === 'FEASIBLE') {
        showToast(
          'info',
          'Feasible Schedule Solved',
          `Solved in ${res.solver.runtime_ms.toFixed(0)} ms with score ${res.solver.objective_score.toFixed(1)}.`,
        );
      }
    } catch (err: unknown) {
      if (generationTimerRef.current) {
        clearInterval(generationTimerRef.current);
        generationTimerRef.current = null;
      }
      const msg = err instanceof Error ? err.message : 'Unknown generation error';
      showToast('error', 'Generation Error', msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Publication Operation (Gated by Independent Validation) ───────────────

  const handlePublish = async () => {
    // Only current draft run can be published
    const runId = simulationResult?.run_id;
    if (!selectedSemId || !runId) {
      showToast('error', 'Cannot Publish', 'No fresh, uncorrupted schedule run available to publish.');
      return;
    }

    if (!simulationResult?.validation || !simulationResult.validation.valid) {
      showToast('error', 'Publication Blocked', 'Hard constraint violations must be resolved first.');
      return;
    }

    setIsPublishing(true);
    try {
      const pubRes = await publishSchedule(selectedSemId, runId, 'Academic Administrator');
      showToast('success', 'Schedule Published', `Version ${pubRes.version} is now authoritative for this semester.`);
      const updated = await fetchPublished(selectedSemId);
      setPublishedInfo(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Publication failed';
      showToast('error', 'Publication Error', msg);
    } finally {
      setIsPublishing(false);
    }
  };

  // ─── CSV Export Operation ──────────────────────────────────────────────────

  const handleExportCsv = async (sheetName?: string) => {
    if (!selectedSemId) return;
    try {
      const csvDict = await fetchExportCsv(selectedSemId);
      const keys = Object.keys(csvDict);
      if (keys.length === 0) {
        showToast('info', 'No Data to Export', 'Please generate or load a timetable first.');
        return;
      }

      if (sheetName && csvDict[sheetName]) {
        downloadCsvFile(csvDict[sheetName], `${selectedSemId}_${sheetName}.csv`);
        showToast('success', 'CSV Exported', `Downloaded ${sheetName}.csv`);
      } else {
        const targetKey = keys.includes('theory_timetable.csv') ? 'theory_timetable.csv' : keys[0];
        downloadCsvFile(csvDict[targetKey], `${selectedSemId}_timetable.csv`);
        showToast('success', 'Timetable Exported', `Downloaded ${targetKey}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      showToast('error', 'CSV Export Failed', msg);
    }
  };

  // ─── Accurate Faculty Workload Calculation from Scheduled Durations ─────────

  const facultyWorkloadMap = useMemo(() => {
    const workload: Record<string, { theoryHours: number; practicalHours: number; totalHours: number; uniqueSessions: number }> = {};

    facultyList.forEach((fac) => {
      workload[fac.id] = { theoryHours: 0, practicalHours: 0, totalHours: 0, uniqueSessions: 0 };
    });

    activeTimetable.forEach((divGrid) => {
      divGrid.slots.forEach((dayPeriods) => {
        dayPeriods.forEach((periodCells) => {
          periodCells.forEach((cell) => {
            if (cell.is_break || !cell.faculty_name) return;

            // Multi-period sessions are only counted once on their primary period to avoid double counting
            if (cell.is_continuation) return;

            const fac = facultyList.find(
              (f) => f.name.toLowerCase().trim() === cell.faculty_name?.toLowerCase().trim() || f.id === cell.faculty_name,
            );
            if (fac && workload[fac.id]) {
              const durationHours = (cell.end_minute - cell.start_minute) / 60;
              const isPrac = Boolean(cell.batch_code);

              if (isPrac) {
                workload[fac.id].practicalHours += durationHours;
              } else {
                workload[fac.id].theoryHours += durationHours;
              }
              workload[fac.id].totalHours += durationHours;
              workload[fac.id].uniqueSessions += 1;
            }
          });
        });
      });
    });

    return workload;
  }, [activeTimetable, facultyList]);

  const currentSemesterName = useMemo(() => {
    const s = semesters.find((item) => item.id === selectedSemId);
    return s ? s.name : selectedSemId || 'No Semester Selected';
  }, [semesters, selectedSemId]);

  // Publication State Indicator
  const publicationBadge = useMemo(() => {
    if (backendOnline === false) return { label: 'Backend Offline', color: 'bg-stone-200 text-stone-700 border-stone-300' };
    if (isGenerating) return { label: 'Solving Constraints…', color: 'bg-primary/5 text-primary border-primary/20 animate-pulse' };
    if (simulationResult?.validation && !simulationResult.validation.valid) {
      return { label: 'Validation Failed', color: 'bg-red-50 text-red-700 border-red-200' };
    }
    if (publishedInfo?.published) {
      return {
        label: `Published (${publishedInfo.schedule?.schedule_run_id ? publishedInfo.schedule.schedule_run_id.slice(-6) : 'Current'})`,
        color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    }
    if (simulationResult?.run_id) {
      return { label: 'Validated Draft — Ready', color: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
    return { label: 'No Active Schedule', color: 'bg-stone-100 text-stone-600 border-stone-200' };
  }, [backendOnline, isGenerating, simulationResult, publishedInfo]);

  // Days dynamically retrieved from active schedule (falls back to standard working days)
  const scheduledDays = useMemo(() => {
    if (activeTimetable.length > 0 && activeTimetable[0].days.length > 0) {
      return activeTimetable[0].days;
    }
    return DAY_NAMES;
  }, [activeTimetable]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex bg-background text-foreground selection:bg-primary/10 font-sans">
      {/* ─── Compact Sidebar Navigation ──────────────────────────────────── */}
      <aside className="w-64 bg-card border-r border-stone-200 flex flex-col justify-between shrink-0 no-print z-20">
        <div>
          {/* Branding Identity */}
          <div className="h-16 flex items-center px-5 border-b border-stone-200 space-x-3">
            <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center text-primary-foreground shadow-xs">
              <Workflow className="w-4 h-4 text-primary/70" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm tracking-tight text-foreground">Cadence</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-100 text-stone-600">v3.0</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium leading-none mt-0.5">University Timetabling</p>
            </div>
          </div>

          {/* Academic Scope Selectors (Dynamic, Database-Backed) */}
          <div className="p-4 border-b border-stone-200 bg-background/50 space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">
              <span>Academic Context</span>
              <Building2 className="w-3 h-3 text-stone-400" />
            </div>

            {/* Institution Selector */}
            <div>
              <label className="text-[11px] text-muted-foreground block mb-0.5">Institution</label>
              <select
                value={selectedInstId}
                onChange={(e) => setSelectedInstId(e.target.value)}
                className="w-full bg-card border border-stone-200 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary"
              >
                {institutions.length === 0 ? (
                  <option value="">Loading institutions…</option>
                ) : (
                  institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Department Selector */}
            <div>
              <label className="text-[11px] text-muted-foreground block mb-0.5">Department</label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="w-full bg-card border border-stone-200 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary"
              >
                {departments.length === 0 ? (
                  <option value="">No departments</option>
                ) : (
                  departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.code} — {dept.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Semester Selector */}
            <div>
              <label className="text-[11px] text-muted-foreground block mb-0.5">Semester</label>
              <select
                value={selectedSemId}
                onChange={(e) => setSelectedSemId(e.target.value)}
                className="w-full bg-card border border-stone-200 rounded-md px-2.5 py-1.5 text-xs font-bold text-primary focus:outline-none focus:border-primary"
              >
                {semesters.length === 0 ? (
                  <option value="">No semesters</option>
                ) : (
                  semesters.map((sem) => (
                    <option key={sem.id} value={sem.id}>
                      {sem.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {[
              { id: 'overview', label: 'Overview', icon: Workflow },
              { id: 'generate', label: 'Generate Timetable', icon: Sparkles },
              { id: 'master', label: 'Master Timetable', icon: Calendar },
              { id: 'faculty', label: 'Faculty View', icon: GraduationCap },
              { id: 'class', label: 'Class View', icon: Users },
              { id: 'settings', label: 'Settings & Policies', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as typeof activeTab)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all ${isActive
                    ? 'bg-primary/5 text-primary font-semibold border border-primary/20 shadow-xs'
                    : 'text-stone-600 hover:bg-muted hover:text-foreground'
                    }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Connectivity & Status */}
        <div className="p-4 border-t border-stone-200 bg-background text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground font-medium">FastAPI Engine</span>
            <div
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${backendOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-emerald-600' : 'bg-red-600'}`} />
              <span>{backendOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground truncate font-mono">127.0.0.1:8000</div>
          {backendOnline === false && (
            <button
              type="button"
              onClick={checkConnectivity}
              className="w-full py-1 text-[11px] bg-card border border-red-300 text-red-700 rounded hover:bg-red-50 font-medium transition-colors"
            >
              Retry Connection
            </button>
          )}
        </div>
      </aside>

      {/* ─── Main Content Area ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Global Top Header Bar */}
        <header className="h-16 bg-card border-b border-stone-200 flex items-center justify-between px-6 shrink-0 no-print">
          <div>
            <h1 className="text-base font-bold text-foreground capitalize">
              {activeTab === 'overview' && 'System Overview & Real-Time Metrics'}
              {activeTab === 'generate' && 'Timetable Generation Studio'}
              {activeTab === 'master' && 'Master Timetable Grid'}
              {activeTab === 'faculty' && 'Faculty Teaching Assignments & Workload'}
              {activeTab === 'class' && 'Class & Batch Timetable'}
              {activeTab === 'settings' && 'Institutional Configuration & Room Policies'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active Scope: <strong className="text-foreground">{currentSemesterName}</strong>
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center space-x-3">
            <span className={`text-xs px-2.5 py-1 rounded-md font-medium border ${publicationBadge.color}`}>
              {publicationBadge.label}
            </span>

            {/* Quick Generate Action */}
            <button
              type="button"
              disabled={isGenerating || !selectedSemId || backendOnline === false}
              onClick={handleGenerate}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium text-primary-foreground shadow-xs transition-all ${isGenerating ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 active:scale-95'
                }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? `Solving… (${(elapsedMs / 1000).toFixed(1)}s)` : 'Generate'}</span>
            </button>

            {/* Print Action */}
            <button
              type="button"
              onClick={() => window.print()}
              className="p-1.5 text-stone-600 hover:text-foreground hover:bg-stone-100 rounded-md transition-colors"
              title="Print Timetable"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ─── View Content ────────────────────────────────────────────────── */}
        <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
          {/* VIEW 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Metric Statistics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-stone-200 rounded-lg p-4.5 shadow-xs">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>Enrolled Cohorts</span>
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-foreground mt-2">
                    {divisions.length > 0 ? `${divisions.length} Divisions` : 'None Configured'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {divisions.length > 0
                      ? `${divisions.reduce((acc, d) => acc + (d.student_count || 0), 0)} registered students`
                      : 'No student divisions in scope'}
                  </div>
                </div>

                <div className="bg-card border border-stone-200 rounded-lg p-4.5 shadow-xs">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>Teaching Faculty</span>
                    <GraduationCap className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-foreground mt-2">
                    {facultyList.length > 0 ? `${facultyList.length} Active Faculty` : 'None Configured'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{assignments.length} assigned offerings in semester</div>
                </div>

                <div className="bg-card border border-stone-200 rounded-lg p-4.5 shadow-xs">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>Room Facilities</span>
                    <DoorOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-foreground mt-2">
                    {roomsList.length > 0 ? `${roomsList.length} Rooms` : 'None Configured'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {roomsList.filter((r) => r.room_type === 'lab').length} laboratories •{' '}
                    {roomsList.filter((r) => r.room_type === 'classroom').length} classrooms
                  </div>
                </div>

                <div className="bg-card border border-stone-200 rounded-lg p-4.5 shadow-xs">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>Timetable Status</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold text-foreground mt-2">
                    {publishedInfo?.published ? 'Published' : simulationResult?.run_id ? 'Draft Solved' : 'Unscheduled'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    {publishedInfo?.schedule?.schedule_run_id || simulationResult?.run_id || 'No active run'}
                  </div>
                </div>
              </div>

              {/* Precheck & Independent Validation Status Card */}
              <div className="bg-card border border-stone-200 rounded-lg p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <h2 className="text-sm font-bold text-foreground">
                      Precheck Feasibility & Independent Validation
                    </h2>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${simulationResult?.validation
                      ? simulationResult.validation.valid
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-stone-100 text-stone-600 border border-stone-200'
                      }`}
                  >
                    {simulationResult?.validation
                      ? simulationResult.validation.valid
                        ? 'Validation Passed (0 Violations)'
                        : `${simulationResult.validation.violations.length} Hard Violations`
                      : 'Validation: Not Validated'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Precheck Summary */}
                  <div className="bg-background border border-stone-200 rounded-md p-4 space-y-2">
                    <div className="font-bold text-foreground flex items-center justify-between">
                      <span>Pre-Solver Feasibility Check</span>
                      <span className="font-semibold">
                        {precheckResult
                          ? precheckResult.passed
                            ? '✓ Feasible'
                            : '✕ Infeasible'
                          : 'Precheck: Not Checked'}
                      </span>
                    </div>
                    <p className="text-stone-600 leading-relaxed">
                      Evaluates period-level demand (1 period/theory lecture, 2 periods/practical block) against discrete
                      available slot capacity before solver execution.
                    </p>
                    {precheckResult?.per_division_slot_capacity && (
                      <div className="mt-3 pt-2 border-t border-stone-200 space-y-1">
                        {Object.entries(precheckResult.per_division_slot_capacity).map(([divId, cap]) => {
                          const dem = precheckResult.per_division_slot_demand[divId] || 0;
                          return (
                            <div key={divId} className="flex justify-between text-[11px] text-stone-600">
                              <span className="font-mono font-semibold">{divId}</span>
                              <span>
                                Demand: {dem} periods / Capacity: {cap} periods
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Independent Validator Summary */}
                  <div className="bg-background border border-stone-200 rounded-md p-4 space-y-2">
                    <div className="font-bold text-foreground flex items-center justify-between">
                      <span>Post-Generation Independent Validator</span>
                      <span className="font-semibold">
                        {simulationResult?.validation
                          ? simulationResult.validation.valid
                            ? '✓ 0 Hard Violations'
                            : `✕ ${simulationResult.validation.violations.length} Violations`
                          : 'Status: Not Validated'}
                      </span>
                    </div>
                    <p className="text-stone-600 leading-relaxed">
                      Rigidly verifies teacher exclusivity, cohort exclusivity, room exclusivity across every occupied
                      period, lab suitability, and protected room reservation policies.
                    </p>

                    {simulationResult?.validation?.violations && simulationResult.validation.violations.length > 0 ? (
                      <div className="mt-3 pt-2 border-t border-red-200 space-y-1.5 max-h-36 overflow-y-auto">
                        {simulationResult.validation.violations.map((v, i) => (
                          <div key={i} className="text-[11px] text-red-700 bg-red-50 p-2 rounded border border-red-200">
                            <span className="font-mono font-bold">[{v.code}]</span> {v.message}
                          </div>
                        ))}
                      </div>
                    ) : simulationResult?.validation?.valid ? (
                      <div className="text-[11px] text-emerald-800 bg-emerald-50/80 p-2 rounded border border-emerald-200 mt-2">
                        All hard constraints verified: no double-booked teachers, no room collisions, and lab
                        reservations strictly honored across every occupied period.
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground italic mt-2">
                        Run a simulation to generate and independently validate assignments.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actionable Shortcuts */}
              <div className="flex items-center space-x-3 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('generate')}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  Open Generation Studio
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('master')}
                  className="px-4 py-2 bg-card border border-stone-200 text-foreground hover:bg-background rounded-md font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  View Master Timetable
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: GENERATE TIMETABLE STUDIO */}
          {activeTab === 'generate' && (
            <div className="space-y-6">
              {/* Generation Control Panel */}
              <div className="bg-card border border-stone-200 rounded-lg p-5 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <div>
                      <h2 className="text-sm font-bold text-foreground">Timetable Generation Studio</h2>
                      <p className="text-xs text-muted-foreground">
                        Execute discrete constraint-based scheduling across all divisions in {currentSemesterName}.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Precheck Button */}
                    <button
                      type="button"
                      disabled={isPrechecking || !selectedSemId}
                      onClick={handleRunPrecheck}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-muted border border-stone-200 hover:bg-stone-100 text-foreground rounded-md text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <ShieldCheck className={`w-3.5 h-3.5 ${isPrechecking ? 'animate-spin text-primary' : ''}`} />
                      <span>{isPrechecking ? 'Checking…' : 'Run Precheck'}</span>
                    </button>

                    {/* Scramble Seed */}
                    <button
                      type="button"
                      onClick={() => {
                        const s = Math.floor(Math.random() * 90000) + 10000;
                        setRandomSeed(s);
                        showToast('info', 'Seed Scrambled', `Set solver tie-break seed to ${s}`);
                      }}
                      className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-muted hover:bg-stone-100 border border-stone-200 rounded-md text-xs font-mono text-stone-600 transition-colors cursor-pointer"
                      title="Scramble solver random tie-break seed"
                    >
                      <Dices className="w-3.5 h-3.5 text-primary" />
                      <span>#{randomSeed}</span>
                    </button>
                  </div>
                </div>

                {/* Solver Configuration Form */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Solver Algorithm</label>
                    <div className="flex items-center space-x-1 bg-muted border border-stone-200 rounded-md p-1">
                      <button
                        type="button"
                        onClick={() => setSolverChoice('cpsat')}
                        className={`flex-1 py-1.5 rounded font-semibold text-center transition-colors cursor-pointer ${solverChoice === 'cpsat' ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground'
                          }`}
                      >
                        OR-Tools CP-SAT
                      </button>
                      <button
                        type="button"
                        onClick={() => setSolverChoice('csp')}
                        className={`flex-1 py-1.5 rounded font-semibold text-center transition-colors cursor-pointer ${solverChoice === 'csp' ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground'
                          }`}
                      >
                        Custom CSP
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Solving Time Limit</label>
                    <select
                      value={timeLimitMs}
                      onChange={(e) => setTimeLimitMs(Number(e.target.value))}
                      className="w-full bg-muted border border-stone-200 rounded-md px-3 py-1.5 font-semibold text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value={10000}>10 Seconds (Fast)</option>
                      <option value={30000}>30 Seconds (Standard)</option>
                      <option value={60000}>60 Seconds (Deep Exploration)</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={isGenerating || !selectedSemId || backendOnline === false}
                      onClick={handleGenerate}
                      className={`w-full py-2 px-4 rounded-md text-xs font-bold text-primary-foreground shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer ${isGenerating
                        ? 'bg-primary/50 cursor-not-allowed'
                        : 'bg-primary hover:bg-primary/90 active:scale-[0.99]'
                        }`}
                    >
                      <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                      <span>{isGenerating ? `Solving… (${(elapsedMs / 1000).toFixed(1)}s)` : 'Solve Timetable Now'}</span>
                    </button>
                  </div>
                </div>

                {/* Precheck Diagnostic Output */}
                {precheckResult && (
                  <div
                    className={`p-3.5 rounded-md border text-xs ${precheckResult.passed
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-red-50/70 border-red-200 text-red-900'
                      }`}
                  >
                    <div className="font-bold flex items-center space-x-1.5">
                      {precheckResult.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                      <span>{precheckResult.passed ? 'Feasibility Verified' : 'Feasibility Violations Detected'}</span>
                    </div>
                    {precheckResult.failures.length > 0 && (
                      <ul className="mt-2 list-disc list-inside space-y-1">
                        {precheckResult.failures.map((f, i) => (
                          <li key={i}>
                            <strong>[{f.code}]</strong> {f.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Generation Outcome & Diagnostics */}
              {simulationResult?.solver && (
                <div className="bg-card border border-stone-200 rounded-lg p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Authoritative Generation Results</h3>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        Run ID: {simulationResult.run_id} • Solver: {simulationResult.solver.status}
                      </div>
                    </div>

                    {/* Publish Action Button (Only enabled when current draft passed independent validation) */}
                    <button
                      type="button"
                      disabled={
                        isPublishing ||
                        isGenerating ||
                        !simulationResult.validation?.valid
                      }
                      onClick={handlePublish}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-md font-bold text-xs shadow-xs transition-all cursor-pointer ${simulationResult.validation?.valid
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-primary-foreground active:scale-95'
                        : 'bg-stone-200 text-stone-500 cursor-not-allowed'
                        }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isPublishing ? 'Publishing…' : 'Publish This Schedule'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-background p-3 rounded-md border border-stone-200">
                      <div className="text-muted-foreground">Solving Duration</div>
                      <div className="font-bold text-foreground mt-1 text-sm">
                        {simulationResult.solver.runtime_ms.toFixed(0)} ms
                      </div>
                    </div>

                    <div className="bg-background p-3 rounded-md border border-stone-200">
                      <div className="text-muted-foreground">Scheduled Occurrences</div>
                      <div className="font-bold text-emerald-700 mt-1 text-sm">
                        {simulationResult.solver.assignments.length} Sessions
                      </div>
                    </div>

                    <div className="bg-background p-3 rounded-md border border-stone-200">
                      <div className="text-muted-foreground">Unscheduled Sessions</div>
                      <div
                        className={`font-bold mt-1 text-sm ${simulationResult.solver.unscheduled_occurrence_ids.length === 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                          }`}
                      >
                        {simulationResult.solver.unscheduled_occurrence_ids.length}
                      </div>
                    </div>

                    <div className="bg-background p-3 rounded-md border border-stone-200">
                      <div className="text-muted-foreground">Optimization Score</div>
                      <div className="font-bold text-foreground mt-1 text-sm">
                        {simulationResult.solver.objective_score.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: MASTER TIMETABLE */}
          {activeTab === 'master' && (
            <div className="space-y-4">
              {/* Filters & Export Header */}
              <div className="bg-card border border-stone-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs no-print shadow-xs">
                <div className="flex items-center flex-wrap gap-2.5">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search subject, faculty, room…"
                      value={masterSearch}
                      onChange={(e) => setMasterSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-muted border border-stone-200 rounded-md focus:outline-none focus:border-primary w-56 text-foreground"
                    />
                    {masterSearch && (
                      <button
                        type="button"
                        onClick={() => setMasterSearch('')}
                        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Division Filter */}
                  <div className="flex items-center space-x-1.5 bg-muted border border-stone-200 rounded-md px-2.5 py-1.5">
                    <span className="text-muted-foreground">Division:</span>
                    <select
                      value={masterDivisionFilter}
                      onChange={(e) => setMasterDivisionFilter(e.target.value)}
                      className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Divisions</option>
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Kind Filter */}
                  <div className="flex items-center space-x-1 bg-muted border border-stone-200 rounded-md p-0.5">
                    {(['all', 'theory', 'practical'] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setMasterKindFilter(k)}
                        className={`px-2.5 py-1 rounded capitalize font-semibold transition-colors cursor-pointer ${masterKindFilter === k ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground'
                          }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CSV Downloads */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleExportCsv('theory_timetable.csv')}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-card border border-stone-200 hover:bg-muted rounded-md text-stone-600 hover:text-foreground font-medium transition-colors cursor-pointer"
                    title="Export Theory Lectures CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                    <span>Theory CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCsv('practical_batch.csv')}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-card border border-stone-200 hover:bg-muted rounded-md text-stone-600 hover:text-foreground font-medium transition-colors cursor-pointer"
                    title="Export Practical Batches CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Practical CSV</span>
                  </button>
                </div>
              </div>

              {/* Master Grids for each Division */}
              {activeTimetable.length === 0 ? (
                <div className="bg-card border border-stone-200 rounded-lg p-12 text-center shadow-xs">
                  <Calendar className="w-8 h-8 text-stone-400 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-foreground">No Timetable Loaded</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Click <strong>Generate Timetable</strong> to solve an authoritative schedule for {currentSemesterName}.
                  </p>
                </div>
              ) : (
                activeTimetable
                  .filter((dGrid) => masterDivisionFilter === 'all' || dGrid.division_id === masterDivisionFilter)
                  .map((dGrid) => {
                    const divisionMeta = divisions.find((d) => d.id === dGrid.division_id);
                    return (
                      <div key={dGrid.division_id} className="bg-card border border-stone-200 rounded-lg p-5 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-foreground">{dGrid.division_display_name}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-medium">
                              {divisionMeta?.student_count !== undefined ? `${divisionMeta.student_count} Students` : 'Class Division'}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center space-x-4">
                            <span className="flex items-center space-x-1">
                              <span className="w-2.5 h-2.5 rounded-sm bg-purple-100 border border-primary/30" />
                              <span>1h Lecture</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300" />
                              <span>2h Lab Block</span>
                            </span>
                          </div>
                        </div>

                        {/* Conventional Timetable Grid: Rows = Periods, Columns = Days */}
                        <ConventionalTimetableGrid
                          divisionGrid={dGrid}
                          searchQuery={masterSearch}
                          kindFilter={masterKindFilter}
                          slotConfigs={slotConfigs}
                          onSelectCell={(cell, dayName, slotLabel) =>
                            setSelectedCellDetail({
                              cell,
                              dayName,
                              divisionName: dGrid.division_display_name,
                              slotLabel,
                            })
                          }
                        />
                      </div>
                    );
                  })
              )}
            </div>
          )}

          {/* VIEW 4: FACULTY VIEW */}
          {activeTab === 'faculty' && (
            <div className="space-y-4">
              {/* Faculty Selector & Workload Header */}
              <div className="bg-card border border-stone-200 rounded-lg p-4.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs no-print">
                <div className="flex items-center space-x-3">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  <div>
                    <span className="text-muted-foreground font-medium">Select Faculty Member:</span>
                    <div className="mt-1">
                      <select
                        value={selectedFacultyId}
                        onChange={(e) => setSelectedFacultyId(e.target.value)}
                        className="bg-muted border border-stone-200 rounded-md px-3 py-1.5 font-bold text-foreground focus:outline-none focus:border-primary cursor-pointer"
                      >
                        {facultyList.map((f) => {
                          const wl = facultyWorkloadMap[f.id]?.totalHours || 0;
                          const maxStr = f.max_weekly_hours ? `${f.max_weekly_hours}h` : 'No limit';
                          return (
                            <option key={f.id} value={f.id}>
                              {f.name} ({wl}h / {maxStr})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Workload Stats from Actual Scheduled Sessions */}
                {selectedFacultyId && (() => {
                  const facMeta = facultyList.find((f) => f.id === selectedFacultyId);
                  const wl = facultyWorkloadMap[selectedFacultyId];
                  return (
                    <div className="flex items-center space-x-6 bg-background border border-stone-200 rounded-md px-4 py-2.5">
                      <div>
                        <div className="text-muted-foreground">Assigned Workload</div>
                        <div className="text-base font-bold text-foreground mt-0.5">
                          {wl?.totalHours || 0} Hours/Week
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Theory vs Lab Sessions</div>
                        <div className="text-xs font-semibold text-stone-800 mt-0.5">
                          {wl?.theoryHours || 0}h Theory • {wl?.practicalHours || 0}h Practical
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Configured Maximum Limit</div>
                        <div className="text-xs font-semibold text-stone-800 mt-0.5">
                          {facMeta?.max_weekly_hours ? `${facMeta.max_weekly_hours} Hours/Week` : 'No limit configured'}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Faculty Schedule Grid: Rows = Periods, Columns = Days */}
              <div className="bg-card border border-stone-200 rounded-lg p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <h3 className="text-sm font-bold text-foreground">
                    Weekly Schedule:{' '}
                    <span className="text-primary">
                      {facultyList.find((f) => f.id === selectedFacultyId)?.name || 'Faculty Member'}
                    </span>
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Aggregated across all assigned classes and practical batches
                  </span>
                </div>

                <FacultyScheduleGrid
                  facultyName={facultyList.find((f) => f.id === selectedFacultyId)?.name || ''}
                  activeTimetable={activeTimetable}
                  slotConfigs={slotConfigs}
                  scheduledDays={scheduledDays}
                  onSelectCell={(cell, dayName, divisionName, slotLabel) =>
                    setSelectedCellDetail({ cell, dayName, divisionName, slotLabel })
                  }
                />
              </div>
            </div>
          )}

          {/* VIEW 5: CLASS VIEW */}
          {activeTab === 'class' && (
            <div className="space-y-4">
              {/* Class / Division Selector Header */}
              <div className="bg-card border border-stone-200 rounded-lg p-4.5 shadow-xs flex items-center justify-between text-xs no-print">
                <div className="flex items-center space-x-3">
                  <Users className="w-5 h-5 text-primary" />
                  <div className="flex items-center space-x-2">
                    <span className="text-muted-foreground font-medium">Select Class / Division:</span>
                    <select
                      value={selectedDivisionId}
                      onChange={(e) => setSelectedDivisionId(e.target.value)}
                      className="bg-muted border border-stone-200 rounded-md px-3 py-1.5 font-bold text-foreground focus:outline-none focus:border-primary cursor-pointer"
                    >
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.display_name} ({d.student_count} Students)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Batch Badges */}
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-muted-foreground">Configured Batches:</span>
                  {divisions
                    .find((d) => d.id === selectedDivisionId)
                    ?.batches?.map((b) => (
                      <span key={b.id} className="px-2 py-0.5 rounded bg-stone-100 font-mono font-medium text-stone-800">
                        {b.code} ({b.student_count})
                      </span>
                    )) || <span className="italic text-stone-400">None</span>}
                </div>
              </div>

              {/* Class Timetable Grid: Rows = Periods, Columns = Days */}
              {(() => {
                const dGrid = activeTimetable.find((d) => d.division_id === selectedDivisionId);
                if (!dGrid) {
                  return (
                    <div className="bg-card border border-stone-200 rounded-lg p-12 text-center shadow-xs">
                      <Calendar className="w-8 h-8 text-stone-400 mx-auto mb-3" />
                      <h3 className="text-sm font-bold text-foreground">No Schedule for Selected Division</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Generate a timetable to inspect lectures and laboratory batches for this class.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="bg-card border border-stone-200 rounded-lg p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{dGrid.division_display_name} Timetable</h3>
                        <div className="text-xs text-muted-foreground">
                          Theory lectures scheduled for whole division; Practical batches parallelized in labs
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExportCsv('practical_batch.csv')}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-card border border-stone-200 hover:bg-background rounded-md text-xs font-semibold text-foreground cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Export Practical CSV</span>
                      </button>
                    </div>

                    <ConventionalTimetableGrid
                      divisionGrid={dGrid}
                      searchQuery=""
                      kindFilter="all"
                      slotConfigs={slotConfigs}
                      onSelectCell={(cell, dayName, slotLabel) =>
                        setSelectedCellDetail({
                          cell,
                          dayName,
                          divisionName: dGrid.division_display_name,
                          slotLabel,
                        })
                      }
                    />
                  </div>
                );
              })()}
            </div>
          )}

          {/* VIEW 6: SETTINGS & POLICIES */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              {/* Sub-Tab Navigation Header */}
              <div className="bg-card border border-stone-200 rounded-lg p-3 shadow-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setSettingsSubTab('assign')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs transition cursor-pointer flex items-center space-x-1.5 ${settingsSubTab === 'assign'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-background hover:bg-stone-100 text-stone-600'
                      }`}
                  >
                    <span>✍️</span>
                    <span>Subject Assignments</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsSubTab('offerings')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs transition cursor-pointer flex items-center space-x-1.5 ${settingsSubTab === 'offerings'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-background hover:bg-stone-100 text-stone-600'
                      }`}
                  >
                    <span>📚</span>
                    <span>Semester Offerings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsSubTab('classes')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs transition cursor-pointer flex items-center space-x-1.5 ${settingsSubTab === 'classes'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-background hover:bg-stone-100 text-stone-600'
                      }`}
                  >
                    <span>👥</span>
                    <span>Classes & Batches</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsSubTab('faculty')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs transition cursor-pointer flex items-center space-x-1.5 ${settingsSubTab === 'faculty'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-background hover:bg-stone-100 text-stone-600'
                      }`}
                  >
                    <span>🎓</span>
                    <span>Institutional Faculty</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsSubTab('rooms')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs transition cursor-pointer flex items-center space-x-1.5 ${settingsSubTab === 'rooms'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-background hover:bg-stone-100 text-stone-600'
                      }`}
                  >
                    <span>🏢</span>
                    <span>Rooms & Reservations</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsSubTab('slots')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs transition cursor-pointer flex items-center space-x-1.5 ${settingsSubTab === 'slots'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-background hover:bg-stone-100 text-stone-600'
                      }`}
                  >
                    <span>⏱️</span>
                    <span>Discrete Period Rules</span>
                  </button>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground px-2 py-1 rounded bg-background border border-stone-200">
                  Active: {currentSemesterName}
                </div>
              </div>

              {/* Sub-Tab 1: Subject Assignments */}
              {settingsSubTab === 'assign' && (
                <div className="space-y-4">
                  {/* Create Assignment Form */}
                  <form
                    onSubmit={handleCreateAssignment}
                    className="bg-card border border-stone-200 p-4 rounded-lg shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
                  >
                    <div>
                      <label className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                        Target Class
                      </label>
                      <select
                        value={newAsgnDivisionId}
                        onChange={(e) => {
                          setNewAsgnDivisionId(e.target.value);
                          setNewAsgnScope('division');
                        }}
                        className="w-full bg-background border border-stone-200 rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                        required
                      >
                        {divisions.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.display_name || d.code}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                        Subject Offering
                      </label>
                      <select
                        value={newAsgnOfferingId}
                        onChange={(e) => setNewAsgnOfferingId(e.target.value)}
                        className="w-full bg-background border border-stone-200 rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                        required
                      >
                        {offeringsList.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.subject_code || o.code} ({o.hours_per_week}h · {o.kind})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                        Assignment Scope
                      </label>
                      <select
                        value={newAsgnScope}
                        onChange={(e) => setNewAsgnScope(e.target.value)}
                        className="w-full bg-background border border-stone-200 rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                        required
                      >
                        <option value="division">Whole Class (Theory Lecture)</option>
                        {divisions
                          .find((d) => d.id === newAsgnDivisionId)
                          ?.batches?.map((b) => (
                            <option key={b.id} value={b.id}>
                              Batch {b.code} ({b.student_count} students)
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Eligible Faculty</span>
                        <span className="text-primary text-[9px] lowercase font-normal">Qualified</span>
                      </label>
                      <select
                        value={newAsgnFacultyId}
                        onChange={(e) => setNewAsgnFacultyId(e.target.value)}
                        className="w-full bg-background border border-stone-200 rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                        required
                      >
                        {eligibleFacultyList.length > 0
                          ? eligibleFacultyList.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))
                          : facultyList.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-md text-xs transition shadow-xs cursor-pointer flex items-center justify-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Save Assignment</span>
                      </button>
                    </div>
                  </form>

                  {/* Current Assignments Table */}
                  <div className="bg-card border border-stone-200 rounded-lg shadow-xs overflow-hidden text-xs">
                    <div className="px-4 py-2.5 bg-background border-b border-stone-200 font-bold text-foreground flex justify-between items-center">
                      <span>Saved Teaching Assignments ({assignments.length})</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Persists directly to SQLite</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-background text-muted-foreground border-b border-stone-200 sticky top-0">
                          <tr>
                            <th className="p-2.5 font-semibold">Subject</th>
                            <th className="p-2.5 font-semibold">Class / Batch</th>
                            <th className="p-2.5 font-semibold">Type & Hours</th>
                            <th className="p-2.5 font-semibold">Assigned Faculty</th>
                            <th className="p-2.5 font-semibold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {assignments.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-stone-400 italic">
                                No assignments configured for this semester.
                              </td>
                            </tr>
                          ) : (
                            assignments.map((ta) => (
                              <tr key={ta.id} className="hover:bg-background">
                                <td className="p-2.5 font-bold text-foreground">
                                  {ta.subject_code} · {ta.subject_name || ta.subject_id}
                                </td>
                                <td className="p-2.5 font-mono">
                                  {ta.division_name || ta.division_id}
                                  {ta.batch_code ? ` (Batch ${ta.batch_code})` : ' (Whole Class)'}
                                </td>
                                <td className="p-2.5">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${ta.batch_code ? 'bg-emerald-100 text-emerald-800' : 'bg-primary/10 text-primary'
                                      }`}
                                  >
                                    {ta.batch_code ? '2h Practical Block' : `${ta.hours_per_week || 1}h Theory`}
                                  </span>
                                </td>
                                <td className="p-2.5 font-medium text-primary">{ta.faculty_name}</td>
                                <td className="p-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAssignment(ta.id)}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                    title="Delete Assignment"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Semester Offerings */}
              {settingsSubTab === 'offerings' && (
                <div className="space-y-4">
                  {/* Create Offering Form */}
                  <form
                    onSubmit={handleCreateOffering}
                    className="bg-card border border-stone-200 p-4 rounded-lg shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
                  >
                    <div>
                      <label className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                        Subject (Catalogue)
                      </label>
                      <select
                        value={newOffSubjectId}
                        onChange={(e) => setNewOffSubjectId(e.target.value)}
                        className="w-full bg-background border border-stone-200 rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                        required
                      >
                        {subjectsList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} — {s.name} ({s.kind})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                        Weekly Hours / Occurrences
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="6"
                        value={newOffHours}
                        onChange={(e) => setNewOffHours(Number(e.target.value))}
                        className="w-full bg-background border border-stone-200 rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                        required
                      />
                    </div>

                    <div className="flex items-center space-x-2 pb-2">
                      <input
                        type="checkbox"
                        id="newOffReqLabCheck"
                        checked={newOffReqLab}
                        onChange={(e) => setNewOffReqLab(e.target.checked)}
                        className="rounded border-stone-200 text-primary cursor-pointer"
                      />
                      <label htmlFor="newOffReqLabCheck" className="text-xs text-foreground font-medium cursor-pointer">
                        Requires Laboratory
                      </label>
                    </div>

                    <div>
                      <label className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                        Lab Specialization
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. SPOS / CNS Lab"
                        value={newOffLabSpec}
                        onChange={(e) => setNewOffLabSpec(e.target.value)}
                        className="w-full bg-background border border-stone-200 rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-md text-xs transition shadow-xs cursor-pointer flex items-center justify-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Offering</span>
                      </button>
                    </div>
                  </form>

                  {/* Current Offerings Table */}
                  <div className="bg-card border border-stone-200 rounded-lg shadow-xs overflow-hidden text-xs">
                    <div className="px-4 py-2.5 bg-background border-b border-stone-200 font-bold text-foreground flex justify-between items-center">
                      <span>Curricular Offerings for {currentSemesterName} ({offeringsList.length})</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Stored in SQLite</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-background text-muted-foreground border-b border-stone-200 sticky top-0">
                          <tr>
                            <th className="p-2.5 font-semibold">Subject Code</th>
                            <th className="p-2.5 font-semibold">Subject Name</th>
                            <th className="p-2.5 font-semibold">Type</th>
                            <th className="p-2.5 font-semibold">Hours / Week</th>
                            <th className="p-2.5 font-semibold">Lab Specification</th>
                            <th className="p-2.5 font-semibold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {offeringsList.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-stone-400 italic">
                                No curricular offerings found.
                              </td>
                            </tr>
                          ) : (
                            offeringsList.map((off) => (
                              <tr key={off.id} className="hover:bg-background">
                                <td className="p-2.5 font-bold font-mono text-foreground">{off.code || off.subject_code}</td>
                                <td className="p-2.5 font-medium">{off.name || off.subject_name}</td>
                                <td className="p-2.5">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${off.requires_lab || off.kind === 'practical'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-primary/10 text-primary'
                                      }`}
                                  >
                                    {off.requires_lab || off.kind === 'practical' ? 'Practical Lab' : 'Theory'}
                                  </span>
                                </td>
                                <td className="p-2.5 font-mono">{off.hours_per_week}h / week</td>
                                <td className="p-2.5 text-stone-600">{off.lab_specialization || 'General Lab'}</td>
                                <td className="p-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOffering(off.id)}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                    title="Delete Offering"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 3: Classes & Batches */}
              {settingsSubTab === 'classes' && (
                <div className="space-y-4">
                  {/* Create Division Form */}
                  <form
                    onSubmit={handleCreateDivision}
                    className="bg-card border border-stone-200 p-4 rounded-lg shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
                  >
                    <div>
                      <label className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                        Class Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. TYCE3"
                        value={newDivCode}
                        onChange={(e) => setNewDivCode(e.target.value)}
                        className="w-full bg-background border border-stone-200 rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        placeholder="TYCE3 (Class TY-3)"
                        value={newDivName}
                        onChange={(e) => setNewDivName(e.target.value)}
                        className="w-full bg-background border border-stone-200 rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                        Student Count
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="120"
                        value={newDivCapacity}
                        onChange={(e) => setNewDivCapacity(Number(e.target.value))}
                        className="w-full bg-background border border-stone-200 rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                        required
                      />
                    </div>
                    <div>
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-md text-xs transition shadow-xs cursor-pointer flex items-center justify-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Class & Batches</span>
                      </button>
                    </div>
                  </form>

                  {/* Classes Card Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {divisions.map((div) => (
                      <div key={div.id} className="bg-card border border-stone-200 rounded-lg p-4 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                          <div>
                            <div className="font-bold text-sm text-foreground">{div.display_name || div.code}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">ID: {div.id}</div>
                          </div>
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/5 text-primary font-semibold border border-primary/20">
                            {div.student_count} Students
                          </span>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Constituent Practical Batches
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            {div.batches?.map((b) => (
                              <div key={b.id} className="bg-background border border-stone-200 rounded p-2">
                                <div className="font-bold text-foreground">Batch {b.code}</div>
                                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{b.student_count} students</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-Tab 4: Institutional Faculty Pool */}
              {settingsSubTab === 'faculty' && (
                <div className="bg-card border border-stone-200 rounded-lg shadow-xs overflow-hidden text-xs">
                  <div className="px-4 py-2.5 bg-background border-b border-stone-200 font-bold text-foreground flex justify-between items-center">
                    <span>Institutional Faculty Pool ({facultyList.length} Faculty Members)</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Reused across all academic departments</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="bg-background text-muted-foreground border-b border-stone-200 sticky top-0">
                        <tr>
                          <th className="p-2.5 font-semibold">Faculty Name</th>
                          <th className="p-2.5 font-semibold">ID</th>
                          <th className="p-2.5 font-semibold">Max Weekly Limit</th>
                          <th className="p-2.5 font-semibold">Assigned Workload</th>
                          <th className="p-2.5 font-semibold">Workload Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {facultyList.map((fac) => {
                          const wl = facultyWorkloadMap[fac.id]?.totalHours || 0;
                          const maxLimit = fac.max_weekly_hours || 20;
                          const isOver = wl > maxLimit;
                          return (
                            <tr key={fac.id} className="hover:bg-background">
                              <td className="p-2.5 font-bold text-foreground">{fac.name}</td>
                              <td className="p-2.5 font-mono text-muted-foreground">{fac.id}</td>
                              <td className="p-2.5 font-mono font-medium">{maxLimit}h / week</td>
                              <td className="p-2.5 font-bold text-primary">{wl} Hours</td>
                              <td className="p-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isOver
                                    ? 'bg-red-100 text-red-800'
                                    : wl > 0
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-stone-100 text-stone-600'
                                    }`}
                                >
                                  {isOver ? 'Exceeded' : wl > 0 ? 'Within Cap' : 'Unallocated'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-Tab 5: Rooms & Reservations */}
              {settingsSubTab === 'rooms' && (
                <div className="space-y-4">
                  {/* Protected Room Reservations Panel */}
                  <div className="bg-card border border-amber-200 rounded-lg p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                      <div className="flex items-center space-x-2">
                        <DoorOpen className="w-4 h-4 text-amber-700" />
                        <h3 className="font-bold text-xs text-foreground">Designated Room Reservations Policy</h3>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                        Enforced in Solver & Validator
                      </span>
                    </div>

                    {/* Add Reservation Form */}
                    <form
                      onSubmit={handleCreateRoomReservation}
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end text-xs"
                    >
                      <div>
                        <label className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                          Target Room / Lab
                        </label>
                        <select
                          value={newResRoomId}
                          onChange={(e) => setNewResRoomId(e.target.value)}
                          className="w-full bg-background border border-stone-200 rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                          required
                        >
                          {roomsList.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} ({r.room_type})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                          Reserved Division
                        </label>
                        <select
                          value={newResDivId}
                          onChange={(e) => setNewResDivId(e.target.value)}
                          className="w-full bg-background border border-stone-200 rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                        >
                          <option value="">All Divisions</option>
                          {divisions.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.display_name || d.code}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                          Reserved Subject
                        </label>
                        <select
                          value={newResSubjectId}
                          onChange={(e) => setNewResSubjectId(e.target.value)}
                          className="w-full bg-background border border-stone-200 rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                        >
                          <option value="">All Subjects</option>
                          {subjectsList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} ({s.name})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                          Policy Reason
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Dedicated CNS lab"
                          value={newResReason}
                          onChange={(e) => setNewResReason(e.target.value)}
                          className="w-full bg-background border border-stone-200 rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div>
                        <button
                          type="submit"
                          className="w-full py-1.5 bg-amber-700 hover:bg-amber-800 text-primary-foreground font-bold rounded-md text-xs transition shadow-xs cursor-pointer flex items-center justify-center space-x-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Reservation</span>
                        </button>
                      </div>
                    </form>

                    {/* Active Reservations Table */}
                    <div className="border border-stone-200 rounded-md overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-background text-muted-foreground border-b border-stone-200">
                          <tr>
                            <th className="p-2 font-semibold">Laboratory Room</th>
                            <th className="p-2 font-semibold">Division</th>
                            <th className="p-2 font-semibold">Subject</th>
                            <th className="p-2 font-semibold">Policy Reason</th>
                            <th className="p-2 font-semibold">Type</th>
                            <th className="p-2 font-semibold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {roomReservations.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-3 text-center text-stone-400 italic">
                                No protected room reservations defined.
                              </td>
                            </tr>
                          ) : (
                            roomReservations.map((res) => (
                              <tr key={res.id} className="hover:bg-background">
                                <td className="p-2 font-bold text-foreground">{res.room_name || res.room_id}</td>
                                <td className="p-2 font-mono text-primary font-bold">{res.division_name || res.division_id || 'All'}</td>
                                <td className="p-2 font-medium">{res.subject_code || 'All Subjects'}</td>
                                <td className="p-2 text-stone-600">{res.reason}</td>
                                <td className="p-2">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                    {res.is_exclusive ? 'Exclusive' : 'Priority'}
                                  </span>
                                </td>
                                <td className="p-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRoomReservation(res.id)}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                    title="Delete Reservation"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Rooms Pool Table */}
                  <div className="bg-card border border-stone-200 rounded-lg shadow-xs overflow-hidden text-xs">
                    <div className="px-4 py-2.5 bg-background border-b border-stone-200 font-bold text-foreground flex justify-between items-center">
                      <span>Institutional Rooms & Laboratories ({roomsList.length})</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Strict Room Typing Enforced</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-background text-muted-foreground border-b border-stone-200 sticky top-0">
                          <tr>
                            <th className="p-2.5 font-semibold">Room Name</th>
                            <th className="p-2.5 font-semibold">Room Type</th>
                            <th className="p-2.5 font-semibold">Capacity</th>
                            <th className="p-2.5 font-semibold">Specialization</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {roomsList.map((r) => (
                            <tr key={r.id} className="hover:bg-background">
                              <td className="p-2.5 font-bold text-foreground">{r.name}</td>
                              <td className="p-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${r.room_type === 'lab' ? 'bg-emerald-100 text-emerald-800' : 'bg-primary/10 text-primary'
                                    }`}
                                >
                                  {r.room_type === 'lab' ? 'Laboratory' : 'Lecture Hall / Classroom'}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono">{r.capacity} Seats</td>
                              <td className="p-2.5 text-stone-600">{r.specialization || 'General Purpose'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 6: Discrete Period Rules */}
              {settingsSubTab === 'slots' && (
                <div className="space-y-4">
                  {/* Canonical 3-Window Reference Card */}
                  <div className="bg-card border border-stone-200 rounded-lg p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <h3 className="font-bold text-xs text-foreground">Canonical Time Model Architecture</h3>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/5 text-primary border border-primary/20">
                        1 Slot = 2 Consecutive Periods = 2 Hours
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center text-xs">
                      <div className="p-3 rounded-lg bg-background border border-stone-200 space-y-1">
                        <div className="text-[11px] font-bold text-primary">Slot 1 (Window 1)</div>
                        <div className="font-bold text-sm text-foreground">Periods 1 & 2</div>
                        <div className="text-[11px] font-mono text-stone-600">08:00 – 10:00 (120 mins)</div>
                        <div className="text-[10px] text-muted-foreground pt-1">P1: 08:00–09:00 · P2: 09:00–10:00</div>
                      </div>
                      <div className="p-3 rounded-lg bg-background border border-stone-200 space-y-1">
                        <div className="text-[11px] font-bold text-primary">Slot 2 (Window 2)</div>
                        <div className="font-bold text-sm text-foreground">Periods 3 & 4</div>
                        <div className="text-[11px] font-mono text-stone-600">10:15 – 12:15 (120 mins)</div>
                        <div className="text-[10px] text-muted-foreground pt-1">P3: 10:15–11:15 · P4: 11:15–12:15</div>
                      </div>
                      <div className="p-3 rounded-lg bg-background border border-stone-200 space-y-1">
                        <div className="text-[11px] font-bold text-primary">Slot 3 (Window 3)</div>
                        <div className="font-bold text-sm text-foreground">Periods 5 & 6</div>
                        <div className="text-[11px] font-mono text-stone-600">13:00 – 15:00 (120 mins)</div>
                        <div className="text-[10px] text-muted-foreground pt-1">P5: 13:00–14:00 · P6: 14:00–15:00</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-stone-600 bg-secondary p-2.5 rounded border border-stone-200">
                      <span>Short Break: <strong>10:00 – 10:15 (15 min)</strong></span>
                      <span>Lunch Break: <strong>12:15 – 13:00 (45 min)</strong></span>
                      <span className="text-rose-700 font-semibold">Strict Day Boundary: 15:00</span>
                    </div>
                  </div>

                  {/* Configured Periods Table */}
                  <div className="bg-card border border-stone-200 rounded-lg shadow-xs overflow-hidden text-xs">
                    <div className="px-4 py-2.5 bg-background border-b border-stone-200 font-bold text-foreground">
                      Semester Period Boundaries ({slotConfigs.length} Configured Periods)
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-background text-muted-foreground border-b border-stone-200 sticky top-0">
                          <tr>
                            <th className="p-2.5 font-semibold">Period Index</th>
                            <th className="p-2.5 font-semibold">Period Name</th>
                            <th className="p-2.5 font-semibold">Presentation Timing</th>
                            <th className="p-2.5 font-semibold">Minute Bounds</th>
                            <th className="p-2.5 font-semibold">Slot Window</th>
                            <th className="p-2.5 font-semibold">Period Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {slotConfigs.map((cfg) => {
                            const slotNum = cfg.window_index !== undefined ? cfg.window_index + 1 : Math.floor(cfg.period_index / 2) + 1;
                            return (
                              <tr key={cfg.id} className="hover:bg-background">
                                <td className="p-2.5 font-mono font-bold text-primary">Period {cfg.period_index}</td>
                                <td className="p-2.5 font-bold text-foreground">{cfg.name}</td>
                                <td className="p-2.5 font-mono">{cfg.start_time} – {cfg.end_time}</td>
                                <td className="p-2.5 font-mono text-stone-600">{cfg.start_minute}m – {cfg.end_minute}m (60m)</td>
                                <td className="p-2.5 font-medium">Slot {slotNum}</td>
                                <td className="p-2.5">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.is_break ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                      }`}
                                  >
                                    {cfg.is_break ? 'Break' : 'Teaching Session'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ─── Session Details Popover / Modal ──────────────────────────────── */}
      {selectedCellDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[1px] p-4 no-print">
          <div className="bg-card border border-stone-200 rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-primary tracking-wider">
                  Session Inspection
                </span>
                <h3 className="text-base font-bold text-foreground mt-0.5">
                  {selectedCellDetail.cell.subject_code} — {selectedCellDetail.cell.subject_name || 'Class Session'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCellDetail(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-muted-foreground">Class / Division:</span>
                <span className="font-bold text-foreground">
                  {selectedCellDetail.divisionName}
                  {selectedCellDetail.cell.batch_code ? ` (Batch ${selectedCellDetail.cell.batch_code})` : ' (Full Class)'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-muted-foreground">Assigned Teacher:</span>
                <span className="font-bold text-primary">
                  {selectedCellDetail.cell.faculty_name || 'Unassigned'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-muted-foreground">Allocated Room:</span>
                <span className="font-bold text-foreground">
                  {selectedCellDetail.cell.room_name || 'TBD'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-muted-foreground">Day & Time Window:</span>
                <span className="font-medium text-stone-800">
                  {selectedCellDetail.dayName}, {selectedCellDetail.slotLabel} (
                  {formatTimeRange(selectedCellDetail.cell.start_minute, selectedCellDetail.cell.end_minute)})
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-muted-foreground">Classification:</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded ${selectedCellDetail.cell.batch_code
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-primary/10 text-primary'
                    }`}
                >
                  {selectedCellDetail.cell.batch_code
                    ? `2-Hour Lab Block (${selectedCellDetail.cell.is_continuation ? 'Part 2/2' : 'Part 1/2'})`
                    : '1-Hour Theory Lecture'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCellDetail(null)}
                className="px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-foreground rounded-md text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Toast Notifications ─────────────────────────────────────────── */}
      <div className="toast-container no-print">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast ${toast.type === 'success'
              ? 'toast-success'
              : toast.type === 'error'
                ? 'toast-error'
                : 'toast-info'
              }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {toast.type === 'error' && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-primary shrink-0" />}
            <div>
              <div className="font-bold text-xs">{toast.title}</div>
              {toast.message && <div className="text-[11px] opacity-90 mt-0.5">{toast.message}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PERIOD-WISE TIMETABLE WITH ROWSPAN PRACTICALS ───────────────────────────
// Rows = individual periods (P1..P6). Practicals occupy their starting period's
// cell via rowSpan={2}; their continuation row's cell is skipped. All parallel
// batches at the same (day, startPeriod) share one spanning block.

interface ConventionalTimetableGridProps {
  divisionGrid: DivisionGrid;
  searchQuery: string;
  kindFilter: 'all' | 'theory' | 'practical';
  slotConfigs: SlotConfig[];
  onSelectCell: (cell: GridCell, dayName: string, slotLabel: string) => void;
}

function ConventionalTimetableGrid({
  divisionGrid,
  searchQuery,
  kindFilter,
  slotConfigs,
  onSelectCell,
}: ConventionalTimetableGridProps) {
  const query = searchQuery.toLowerCase().trim();

  const periods = useMemo(() => {
    if (slotConfigs.length > 0) return slotConfigs;
    const count = divisionGrid.slots[0]?.length || 0;
    return Array.from({ length: count }, (_, idx) => ({
      id: `period_${idx}`,
      semester_id: '',
      period_index: idx,
      name: `Period ${idx + 1}`,
      start_time: '',
      end_time: '',
      start_minute: 0,
      end_minute: 0,
      is_break: 0,
      is_usable: 1,
      window_index: Math.floor(idx / 2),
    }));
  }, [slotConfigs, divisionGrid]);

  const matches = (c: GridCell) => {
    if (!query) return true;
    return (
      c.subject_code?.toLowerCase().includes(query) ||
      c.subject_name?.toLowerCase().includes(query) ||
      c.faculty_name?.toLowerCase().includes(query) ||
      c.room_name?.toLowerCase().includes(query)
    );
  };

  /**
   * Build per-day rendering plans:
   *   - primaryByDayPeriod : practicals grouped by (day, startPeriod) — rendered with rowSpan=2
   *   - theoriesByDayPeriod: theory cells grouped by (day, period) — rendered normally
   *   - skipCells          : set of "day-period" whose cell is covered by a prior rowSpan
   *
   * For each practical primary we check that a matching continuation exists
   * in period+1 (same batch, subject, faculty, room). If missing → we still
   * render as a 1-period card (no rowSpan) so nothing silently breaks.
   */
  const { theoriesByDayPeriod, practicalGroupsByDayPeriod, skipCells } = useMemo(() => {
    const theoriesByDayPeriod: Record<string, GridCell[]> = {};
    const practicalGroupsByDayPeriod: Record<
      string,
      { cells: GridCell[]; span: number }
    > = {};
    const skipCells = new Set<string>();

    divisionGrid.days.forEach((_, dayIdx) => {
      const dayPeriods = divisionGrid.slots[dayIdx] || [];

      // First pass: index continuations by their period for easy lookup
      const continuationIndex = new Map<string, Set<number>>();
      // key: `${batch}|${subject}|${faculty}|${room}` → set of period indices that hold continuations
      dayPeriods.forEach((periodCells, pIdx) => {
        periodCells.forEach((c) => {
          if (!c.is_continuation || c.is_break) return;
          const k = `${c.batch_code}|${c.subject_code}|${c.faculty_name}|${c.room_name}`;
          if (!continuationIndex.has(k)) continuationIndex.set(k, new Set());
          continuationIndex.get(k)!.add(pIdx);
        });
      });

      dayPeriods.forEach((periodCells, pIdx) => {
        const theories: GridCell[] = [];

        periodCells.forEach((c) => {
          if (c.is_break) return;
          if (!c.batch_code) {
            // Theory cell
            theories.push(c);
            return;
          }
          if (c.is_continuation) return; // consumed by primary's rowSpan

          // Primary practical: check if matching continuation exists in pIdx+1
          const k = `${c.batch_code}|${c.subject_code}|${c.faculty_name}|${c.room_name}`;
          const contSet = continuationIndex.get(k);
          const hasContinuation = contSet?.has(pIdx + 1) ?? false;
          const canSpan = hasContinuation && pIdx + 1 < dayPeriods.length;

          const groupKey = `${dayIdx}-${pIdx}`;
          if (!practicalGroupsByDayPeriod[groupKey]) {
            practicalGroupsByDayPeriod[groupKey] = { cells: [], span: canSpan ? 2 : 1 };
          }
          practicalGroupsByDayPeriod[groupKey].cells.push(c);

          if (canSpan) {
            skipCells.add(`${dayIdx}-${pIdx + 1}`);
          }
        });

        if (theories.length > 0) {
          theoriesByDayPeriod[`${dayIdx}-${pIdx}`] = theories;
        }
      });
    });

    return { theoriesByDayPeriod, practicalGroupsByDayPeriod, skipCells };
  }, [divisionGrid]);

  return (
    <div className="timetable-container">
      <table className="timetable-table">
        <thead>
          <tr>
            <th className="time-header">Time / Period</th>
            {divisionGrid.days.map((dayName) => (
              <th key={dayName}>{dayName}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((periodCfg, pIdx) => {
            const slotNum =
              periodCfg.window_index !== undefined
                ? periodCfg.window_index + 1
                : Math.floor(pIdx / 2) + 1;
            const periodLabel = periodCfg.name || `P${pIdx + 1}`;
            const timeLabel =
              periodCfg.start_time && periodCfg.end_time
                ? `${periodCfg.start_time} – ${periodCfg.end_time}`
                : '';

            // Break separator row AFTER period 2 and period 4 (between slots)
            const isBreakBefore =
              pIdx === 2
                ? 'Short Break · 10:00 – 10:15 (15 mins)'
                : pIdx === 4
                  ? 'Lunch Break · 12:15 – 13:00 (45 mins)'
                  : null;

            return (
              <React.Fragment key={periodCfg.id || pIdx}>
                {isBreakBefore && (
                  <tr className="bg-secondary border-y border-stone-200">
                    <td
                      colSpan={divisionGrid.days.length + 1}
                      className="py-1 px-4 text-[11px] font-medium text-muted-foreground"
                    >
                      <span className="flex items-center space-x-2">
                        <Coffee className="w-3.5 h-3.5 text-stone-500" />
                        <span>{isBreakBefore}</span>
                      </span>
                    </td>
                  </tr>
                )}

                <tr>
                  <td className="slot-col">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-xs text-foreground">{periodLabel}</span>
                      <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-primary/5 text-primary font-medium">
                        Slot {slotNum}
                      </span>
                    </div>
                    {timeLabel && (
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {timeLabel}
                      </div>
                    )}
                  </td>

                  {divisionGrid.days.map((dayName, dayIdx) => {
                    const cellKey = `${dayIdx}-${pIdx}`;

                    // Continuation cell → render empty filler (rowSpan covers this)
                    if (skipCells.has(cellKey)) {
                      return <td key={dayName} className="p-0" />;
                    }

                    // Check if this cell is a primary practical start
                    const practicalGroup = practicalGroupsByDayPeriod[cellKey];

                    // Collect theory cells for this period (filtered)
                    const theories = (
                      theoriesByDayPeriod[cellKey] || []
                    ).filter((c) => {
                      if (kindFilter === 'practical') return false;
                      return matches(c);
                    });

                    // Filter practicals by search/kind
                    const filteredPracticals =
                      practicalGroup && kindFilter !== 'theory'
                        ? practicalGroup.cells.filter(matches)
                        : [];

                    // If practicals filtered out entirely, treat as empty
                    const showPracticals = filteredPracticals.length > 0;
                    const isEmpty = !showPracticals && theories.length === 0;

                    // Span only if practical is actually shown AND continuation exists
                    const rowSpan =
                      showPracticals && practicalGroup.span === 2 ? 2 : 1;

                    return (
                      <td
                        key={dayName}
                        rowSpan={rowSpan}
                        className="align-top"
                      >
                        {isEmpty ? (
                          <div className="h-full min-h-[64px] flex items-center justify-center text-[#c8c8bd] text-xs font-mono">
                            —
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {/* Theory cards */}
                            {theories.map((cell, i) => (
                              <button
                                key={`t-${i}`}
                                type="button"
                                onClick={() =>
                                  onSelectCell(cell, dayName, periodLabel)
                                }
                                className={`w-full text-left session-card cursor-pointer ${cell.conflict
                                  ? 'session-card-conflict'
                                  : 'session-card-theory'
                                  }`}
                              >
                                <div className="flex items-center justify-between font-bold text-xs">
                                  <span>{cell.subject_code}</span>
                                  <span className="text-[10px] text-primary font-mono">
                                    1h
                                  </span>
                                </div>
                                <div className="text-[11px] font-medium opacity-90 truncate mt-0.5">
                                  {cell.faculty_name || 'No Faculty'}
                                </div>
                                <div className="text-[10px] font-mono opacity-75 mt-0.5">
                                  Room: {cell.room_name || 'TBD'}
                                </div>
                              </button>
                            ))}

                            {/* Practical block — one spanning cell with all parallel batches */}
                            {showPracticals && (
                              <div className="rounded-md border border-emerald-300 bg-emerald-50/70 p-1.5 space-y-1 h-full">
                                <div className="text-[10px] font-bold text-emerald-800 flex items-center justify-between">
                                  <span>
                                    LAB BLOCK · {rowSpan === 2 ? '2h' : '1h'}
                                  </span>
                                  <span className="font-mono">
                                    {filteredPracticals.length} batch
                                    {filteredPracticals.length > 1 ? 'es' : ''} ∥
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {filteredPracticals.map((cell, i) => (
                                    <button
                                      key={`p-${i}`}
                                      type="button"
                                      onClick={() =>
                                        onSelectCell(cell, dayName, periodLabel)
                                      }
                                      className="w-full text-left rounded border border-emerald-200 bg-card px-1.5 py-1 hover:bg-emerald-50 transition-colors cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900">
                                        <span>{cell.subject_code}</span>
                                        <span className="font-mono text-[10px] px-1 rounded bg-emerald-100 text-emerald-800">
                                          {cell.batch_code}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-emerald-800/90 truncate">
                                        {cell.faculty_name}
                                      </div>
                                      <div className="text-[10px] font-mono text-emerald-700/80 truncate">
                                        {cell.room_name}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── STRICT FACULTY SCHEDULE GRID ─────────────────────────────────────────────
// Rows = Time Periods / Sessions. Columns = Days of the Week.

interface FacultyScheduleGridProps {
  facultyName: string;
  activeTimetable: DivisionGrid[];
  slotConfigs: SlotConfig[];
  scheduledDays: string[];
  onSelectCell: (cell: GridCell, dayName: string, divisionName: string, slotLabel: string) => void;
}

function FacultyScheduleGrid({
  facultyName,
  activeTimetable,
  slotConfigs,
  scheduledDays,
  onSelectCell,
}: FacultyScheduleGridProps) {
  const normName = facultyName.toLowerCase().trim();

  const periods = useMemo(() => {
    if (slotConfigs.length > 0) return slotConfigs;
    const count = activeTimetable[0]?.slots[0]?.length || 6;
    return Array.from({ length: count }, (_, idx) => ({
      id: `period_${idx}`, semester_id: '', period_index: idx,
      name: `Period ${idx + 1}`, start_time: '', end_time: '',
      start_minute: 0, end_minute: 0, is_break: 0, is_usable: 1,
      window_index: Math.floor(idx / 2),
    }));
  }, [slotConfigs, activeTimetable]);

  // Build per-(day, period) faculty sessions + skip/spans
  const { sessionsByDayPeriod, skipCells, spanCells } = useMemo(() => {
    const sessionsByDayPeriod: Record<string, Array<{ cell: GridCell; divisionName: string }>> = {};
    const skipCells = new Set<string>();
    const spanCells = new Set<string>();

    scheduledDays.forEach((dayName, dayIdx) => {
      // Gather all faculty sessions grouped by period for this day (across all divisions)
      const perPeriod: Array<Array<{ cell: GridCell; divisionName: string }>> = periods.map(() => []);
      activeTimetable.forEach((divGrid) => {
        const actualDayIdx = divGrid.days.indexOf(dayName);
        if (actualDayIdx < 0) return;
        const dayPeriods = divGrid.slots[actualDayIdx] || [];
        dayPeriods.forEach((periodCells, pIdx) => {
          periodCells.forEach((cell) => {
            if (cell.faculty_name && cell.faculty_name.toLowerCase().trim() === normName) {
              perPeriod[pIdx].push({ cell, divisionName: divGrid.division_display_name });
            }
          });
        });
      });

      perPeriod.forEach((sessions, pIdx) => {
        const key = `${dayIdx}-${pIdx}`;
        const primaries = sessions.filter(
          (s) => !s.cell.is_break && !s.cell.is_continuation,
        );
        const hasContinuation = sessions.some((s) => s.cell.is_continuation);

        if (primaries.length === 0 && !hasContinuation) return;

        // Is this a continuation-only period (faculty only has a continuation here)?
        if (primaries.length === 0 && hasContinuation) {
          skipCells.add(key);
          return;
        }

        sessionsByDayPeriod[key] = primaries;

        // Span if at least one primary practical has a matching continuation next period
        const spanNext = primaries.some((s) => {
          if (!s.cell.batch_code) return false;
          const next = perPeriod[pIdx + 1] || [];
          return next.some(
            (n) =>
              n.cell.is_continuation &&
              n.cell.batch_code === s.cell.batch_code &&
              n.cell.subject_code === s.cell.subject_code,
          );
        });
        if (spanNext) {
          spanCells.add(key);
          skipCells.add(`${dayIdx}-${pIdx + 1}`);
        }
      });
    });

    return { sessionsByDayPeriod, skipCells, spanCells };
  }, [activeTimetable, normName, periods, scheduledDays]);

  return (
    <div className="timetable-container">
      <table className="timetable-table">
        <thead>
          <tr>
            <th className="time-header">Time / Period</th>
            {scheduledDays.map((d) => <th key={d}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {periods.map((periodCfg, pIdx) => {
            const slotNum =
              periodCfg.window_index !== undefined
                ? periodCfg.window_index + 1
                : Math.floor(pIdx / 2) + 1;
            const periodLabel = periodCfg.name || `P${pIdx + 1}`;
            const timeLabel =
              periodCfg.start_time && periodCfg.end_time
                ? `${periodCfg.start_time} – ${periodCfg.end_time}`
                : '';

            const isBreakBefore =
              pIdx === 2
                ? 'Short Break · 10:00 – 10:15'
                : pIdx === 4
                  ? 'Lunch Break · 12:15 – 13:00'
                  : null;

            return (
              <React.Fragment key={periodCfg.id || pIdx}>
                {isBreakBefore && (
                  <tr className="bg-secondary border-y border-stone-200">
                    <td
                      colSpan={scheduledDays.length + 1}
                      className="py-1 px-4 text-[11px] font-medium text-muted-foreground"
                    >
                      <span className="flex items-center space-x-2">
                        <Coffee className="w-3.5 h-3.5 text-stone-500" />
                        <span>{isBreakBefore}</span>
                      </span>
                    </td>
                  </tr>
                )}

                <tr>
                  <td className="slot-col">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-xs text-foreground">{periodLabel}</span>
                      <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-primary/5 text-primary font-medium">
                        Slot {slotNum}
                      </span>
                    </div>
                    {timeLabel && (
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {timeLabel}
                      </div>
                    )}
                  </td>

                  {scheduledDays.map((dayName, dayIdx) => {
                    const key = `${dayIdx}-${pIdx}`;
                    if (skipCells.has(key)) {
                      return <td key={dayName} className="p-0" />;
                    }
                    const sessions = sessionsByDayPeriod[key] || [];
                    const rowSpan = spanCells.has(key) ? 2 : 1;

                    return (
                      <td key={dayName} rowSpan={rowSpan} className="align-top">
                        {sessions.length === 0 ? (
                          <div className="h-full min-h-[64px] flex items-center justify-center text-[#c8c8bd] text-xs font-mono">
                            Free
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {sessions.map(({ cell, divisionName }, i) => {
                              const isPractical = Boolean(cell.batch_code);
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() =>
                                    onSelectCell(cell, dayName, divisionName, periodLabel)
                                  }
                                  className={`w-full text-left session-card cursor-pointer ${isPractical
                                      ? 'session-card-practical'
                                      : 'session-card-theory'
                                    }`}
                                >
                                  <div className="flex items-center justify-between font-bold text-xs">
                                    <span>{cell.subject_code}</span>
                                    <span className="text-[10px] font-mono px-1.5 rounded bg-card/80">
                                      {divisionName}
                                      {cell.batch_code ? `-${cell.batch_code}` : ''}
                                    </span>
                                  </div>
                                  <div className="text-[11px] font-medium opacity-90 truncate mt-0.5">
                                    {isPractical
                                      ? `Lab Block (${rowSpan === 2 ? '2h' : '1h'})`
                                      : 'Lecture (1h)'}
                                  </div>
                                  <div className="text-[10px] font-mono opacity-75 mt-0.5">
                                    Room: {cell.room_name || 'TBD'}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
