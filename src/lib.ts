// Cadence — Centralized API Client & Types
// Handles all communication with the FastAPI backend using typed fetch requests.

const DEFAULT_BASE_URL = 'http://127.0.0.1:8000';
export const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  DEFAULT_BASE_URL
).replace(/\/+$/, '');

// ─── Network & Error Handling ──────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 25000, ...fetchInit } = options;
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(fetchInit.headers || {}),
      },
    });

    if (!res.ok) {
      let errorBody: string;
      try {
        const json = await res.json();
        errorBody = json.detail || json.message || JSON.stringify(json);
      } catch {
        errorBody = await res.text();
      }
      throw new ApiError(`HTTP ${res.status}: ${errorBody || res.statusText}`, res.status, errorBody);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(`Request timeout after ${timeoutMs / 1000}s contacting ${url}`, 408);
    }
    if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
      throw new ApiError(
        `Unable to connect to Cadence backend at ${API_BASE_URL}. Ensure the backend is running.`,
        0,
      );
    }
    throw new ApiError((err as Error).message || 'Unknown network error', 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Core Domain Types ────────────────────────────────────────────────────────

export interface Institution {
  id: string;
  code: string;
  name: string;
  address?: string;
  timezone?: string;
}

export interface Department {
  id: string;
  institution_id: string;
  code: string;
  name: string;
}

export interface AcademicYear {
  id: string;
  institution_id: string;
  code: string;
  name: string;
  start_date?: string;
  end_date?: string;
}

export interface Semester {
  id: string;
  academic_year_id: string;
  department_id: string;
  semester_number: number;
  name: string;
  status: string;
  department_code?: string;
  academic_year_code?: string;
}

export interface Division {
  id: string;
  department_id: string;
  semester_id: string;
  code: string;
  display_name: string;
  student_count: number;
  batches: Batch[];
}

export interface Batch {
  id: string;
  division_id: string;
  code: string;
  student_count: number;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  kind: 'theory' | 'practical';
  is_active?: number;
}

export interface Faculty {
  id: string;
  name: string;
  email?: string;
  max_weekly_hours: number;
  is_active: number;
  departments?: string[];
}

export interface Room {
  id: string;
  name: string;
  room_type: string;
  capacity: number;
  kind: string;
  is_active: number;
  specialization?: string;
}

export interface TeachingAssignment {
  id: string;
  subject_offering_id: string;
  faculty_id: string;
  division_id?: string;
  batch_id?: string;
  faculty_name?: string;
  subject_id?: string;
  subject_code?: string;
  subject_name?: string;
  subject_kind?: string;
  division_name?: string;
  batch_code?: string;
  hours_per_week?: number;
}

export interface SubjectOffering {
  id: string;
  semester_id: string;
  subject_id: string;
  division_id?: string;
  hours_per_week: number;
  is_elective: number;
  requires_lab: number;
  code?: string;
  name?: string;
  kind?: string;
  subject_code?: string;
  subject_name?: string;
  lab_specialization?: string;
}

// ─── Timetable Grid & Simulation Types ────────────────────────────────────────

export interface GridCell {
  slot_index: number;
  start_minute: number;
  end_minute: number;
  subject_code?: string;
  subject_name?: string;
  faculty_name?: string;
  room_name?: string;
  batch_code?: string;
  is_break: boolean;
  conflict: boolean;
  occurrence_id?: string;
  period_index?: number;
  window_index?: number;
  span_periods?: number;
  is_continuation?: boolean;
}

export interface DivisionGrid {
  division_id: string;
  division_display_name: string;
  days: string[];
  slots: GridCell[][][]; // [dayIndex][slotIndex][cellsInsideSlot]
}

export interface GridItem {
  slot: number;
  start_minute: number;
  end_minute: number;
  subject: string;
  faculty: string;
  room: string;
  batch?: string;
}

export interface TimetableGrid {
  instance_id: string;
  divisions: DivisionGrid[];
  grid_by_division?: Record<string, Record<string, GridItem[]>>;
}

export interface PrecheckFailure {
  code: string;
  scope: string;
  entity_id: string;
  message: string;
}

export interface PrecheckResult {
  passed: boolean;
  failures: PrecheckFailure[];
  per_division_slot_capacity: Record<string, number>;
  per_division_slot_demand: Record<string, number>;
  workload: Record<string, number>;
}

export interface Violation {
  code: string;
  scope: string;
  entity_ids: string[];
  message: string;
}

export interface ValidationReport {
  valid: boolean;
  violations: Violation[];
  total_violations: number;
}

export interface ScheduledSession {
  occurrence_id: string;
  subject_id: string;
  faculty_ids: string[];
  room_id: string;
  group_ids: string[];
  day_of_week: number;
  start_minute: number;
  end_minute: number;
}

export interface SolverResult {
  status: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'NO_SOLUTION_FOUND' | 'ERROR' | string;
  runtime_ms: number;
  objective_score: number;
  objective_breakdown: Record<string, number>;
  assignments: ScheduledSession[];
  unscheduled_occurrence_ids: string[];
}

export interface SimulateResponse {
  precheck: PrecheckResult | null;
  solver: SolverResult | null;
  validation: ValidationReport | null;
  timetable: TimetableGrid | null;
  run_id: string | null;
}

export interface SlotConfig {
  id: string;
  semester_id: string;
  period_index: number;
  name: string;
  start_time: string;
  end_time: string;
  start_minute: number;
  end_minute: number;
  is_break: number;
  is_usable: number;
  window_index?: number;
}

export interface RoomReservation {
  id: string;
  room_id: string;
  room_name?: string;
  division_id?: string;
  division_name?: string;
  subject_id?: string;
  subject_code?: string;
  day_of_week?: number;
  start_minute?: number;
  end_minute?: number;
  is_exclusive: number;
  reason: string;
}

export interface PublishedSchedule {
  published: boolean;
  schedule: {
    semester_id: string;
    schedule_run_id: string;
    published_by: string;
    published_at: string;
    status: string;
    solver_name: string;
    runtime_ms: number;
    objective_score: number;
    assignments_count?: number;
  } | null;
}

// ─── API Endpoints ────────────────────────────────────────────────────────────

export const fetchInstitutions = () => request<Institution[]>('/api/institutions');

export const fetchDepartments = (instId?: string) =>
  request<Department[]>(`/api/departments${instId ? `?institution_id=${encodeURIComponent(instId)}` : ''}`);

export const fetchAcademicYears = (instId?: string) =>
  request<AcademicYear[]>(`/api/academic_years${instId ? `?institution_id=${encodeURIComponent(instId)}` : ''}`);

export const fetchSemesters = (deptId?: string, ayId?: string) => {
  const params = new URLSearchParams();
  if (deptId) params.set('department_id', deptId);
  if (ayId) params.set('academic_year_id', ayId);
  const qs = params.toString();
  return request<Semester[]>(`/api/semesters${qs ? `?${qs}` : ''}`);
};

export const fetchDivisions = (semId: string) =>
  request<Division[]>(`/api/semesters/${encodeURIComponent(semId)}/divisions`);

export const fetchOfferings = (semId: string) =>
  request<SubjectOffering[]>(`/api/semesters/${encodeURIComponent(semId)}/offerings`);

export const fetchAssignments = (semId: string) =>
  request<TeachingAssignment[]>(`/api/semesters/${encodeURIComponent(semId)}/assignments`);

export const fetchSlotConfigs = (semId: string) =>
  request<SlotConfig[]>(`/api/semesters/${encodeURIComponent(semId)}/slot_configurations`);

export const fetchPublished = (semId: string) =>
  request<PublishedSchedule>(`/api/semesters/${encodeURIComponent(semId)}/published`);

export const fetchRoomReservations = () =>
  request<RoomReservation[]>('/api/room_reservations');

export const fetchFaculty = () => request<Faculty[]>('/api/faculty');

export const fetchRooms = () => request<Room[]>('/api/rooms');

export const runPrecheck = (semId: string) =>
  request<PrecheckResult>(`/api/semesters/${encodeURIComponent(semId)}/precheck`, { method: 'POST' });

export const runSimulate = (
  semId: string,
  solver: 'cpsat' | 'csp' = 'cpsat',
  timeLimitMs = 30000,
  seed?: number,
) =>
  request<SimulateResponse>('/api/semesters/simulate', {
    method: 'POST',
    body: JSON.stringify({
      semester_id: semId,
      solver,
      time_limit_ms: timeLimitMs,
      ...(seed !== undefined ? { seed } : {}),
    }),
    timeoutMs: timeLimitMs + 15000,
  });

export const fetchTimetable = (semId: string) =>
  request<TimetableGrid>(`/api/semesters/${encodeURIComponent(semId)}/timetable`);

export const fetchExportCsv = (semId: string) =>
  request<Record<string, string>>(`/api/semesters/${encodeURIComponent(semId)}/export_csv`);

export const publishSchedule = (semId: string, runId: string, publishedBy = 'Academic Administrator') =>
  request<{ status: string; version: number; semester_id: string }>(
    `/api/semesters/${encodeURIComponent(semId)}/publish`,
    {
      method: 'POST',
      body: JSON.stringify({ run_id: runId, published_by: publishedBy }),
    },
  );

export const fetchSubjects = () => request<Subject[]>('/api/subjects');

export const fetchEligibleFaculty = (subjectId: string) =>
  request<Faculty[]>(`/api/subjects/${encodeURIComponent(subjectId)}/eligible_faculty`);

export const createAssignment = (semId: string, data: {
  subject_offering_id: string;
  faculty_id: string;
  division_id?: string | null;
  batch_id?: string | null;
}) =>
  request<{ id: string; status: string }>(`/api/semesters/${encodeURIComponent(semId)}/assignments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteAssignment = (assignmentId: string) =>
  request<{ status: string; id: string }>(`/api/assignments/${encodeURIComponent(assignmentId)}`, {
    method: 'DELETE',
  });

export const createOffering = (semId: string, data: {
  subject_id: string;
  division_id?: string | null;
  hours_per_week: number;
  requires_lab: boolean;
  lab_specialization?: string | null;
}) =>
  request<{ id: string; status: string }>(`/api/semesters/${encodeURIComponent(semId)}/offerings`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteOffering = (semId: string, offeringId: string) =>
  request<{ status: string }>(`/api/semesters/${encodeURIComponent(semId)}/offerings/${encodeURIComponent(offeringId)}`, {
    method: 'DELETE',
  });

export const createDivision = (semId: string, data: {
  code: string;
  display_name: string;
  student_count: number;
  department_id?: string;
  batches?: Array<{ code: string; student_count: number }>;
}) =>
  request<{ id: string; status: string }>(`/api/semesters/${encodeURIComponent(semId)}/divisions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const createRoomReservation = (data: {
  room_id: string;
  division_id?: string | null;
  subject_id?: string | null;
  reason?: string;
  is_exclusive?: boolean | number;
}) =>
  request<{ id: string; status: string }>('/api/room_reservations', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteRoomReservation = (resId: string) =>
  request<{ status: string }>(`/api/room_reservations/${encodeURIComponent(resId)}`, {
    method: 'DELETE',
  });

export const healthCheck = () => request<{ ok?: boolean; status?: string }>('/health');

// ─── Utility Helpers ──────────────────────────────────────────────────────────

export function minuteToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function formatTimeRange(startMinute: number, endMinute: number): string {
  return `${minuteToTime(startMinute)} – ${minuteToTime(endMinute)}`;
}

export function downloadCsvFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
