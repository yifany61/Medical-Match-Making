import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Calendar,
  HeartPulse,
  LoaderCircle,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

type Sender = 'user' | 'ai';

type Message = {
  id: string;
  text: string;
  sender: Sender;
};

type HealthCheck = {
  api: string;
  database: string;
  fhir_server: string;
  openai: string;
};

type Snapshot = {
  observations_count: number;
  conditions_count: number;
  medications_count: number;
};

type FhirCodeable = {
  text?: string;
  coding?: { display?: string; code?: string }[];
};
type FhirObservation = {
  code?: FhirCodeable;
  valueQuantity?: { value?: number; unit?: string };
  valueString?: string;
  valueCodeableConcept?: { text?: string };
  component?: {
    code?: FhirCodeable;
    valueQuantity?: { value?: number; unit?: string };
  }[];
};
type FhirCondition = {
  code?: FhirCodeable;
};
type FhirMedication = {
  medicationCodeableConcept?: { text?: string };
};
type PatientRecord = Snapshot & {
  data: {
    observations: FhirObservation[];
    conditions: FhirCondition[];
    medications: FhirMedication[];
  };
};type AnalysisCondition = {
  condition_name: string;
  category: string;
  description: string;
};

type Analysis = {
  overall_summary: string;
  overall_risk_level: string;
  conditions: AnalysisCondition[];
};

type Upload = {
  resources_created: number;
  resource_types: string[];
};

type ChatResponse = {
  message: string;
  data?: {
    assistant_message: string;
    conversation_id: string;
    analysis_result?: Analysis;
    upload_result?: Upload;
  };
};

type Match = {
  doctor_id: number;
  name: string;
  specialty: string;
  sub_specialty?: string | null;
  expertise_description: string;
  location?: string | null;
  consultation_fee?: number | null;
  similarity_score: number;
  matched_skill?: string | null;
  match_reasons: string[];
};

type DoctorDirectoryEntry = {
  id: number;
  name: string;
  specialty: string;
  location?: string | null;
  consultation_fee?: number | null;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:8001/api/v1';

const formatMoney = (value?: number | null) => {
  if (value == null) return 'Not provided';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const avatarSeed = (name: string) => encodeURIComponent(name.toLowerCase().replace(/\s+/g, '-'));

async function readError(response: Response) {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (typeof body?.message === 'string') return body.message;
  } catch {
    return response.statusText;
  }

  return response.statusText;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as T;
}

export default function App() {
  const [patientId, setPatientId] = useState('test-patient-001');
  const [conversationId, setConversationId] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'I need a real consult flow backed by the API, not placeholder UI.',
      sender: 'user',
    },
    {
      id: '2',
      text: 'Send a message, upload structured vitals, or run doctor matching to see live backend responses.',
      sender: 'ai',
    },
  ]);
  const [healthForm, setHealthForm] = useState({
    systolic: '120',
    diastolic: '80',
    heartRate: '72',
    glucose: '',
    symptoms: '',
  });
  const [filters, setFilters] = useState({
    condition: '',
    location: '',
    maxFee: '',
    topK: '5',
  });
  const [healthCheck, setHealthCheck] = useState<HealthCheck | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [patientRecord, setPatientRecord] = useState<PatientRecord | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [directory, setDirectory] = useState<DoctorDirectoryEntry[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [statusText, setStatusText] = useState('Connecting to backend...');
  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState({
    boot: true,
    chat: false,
    upload: false,
    match: false,
  });
  const messageBoxRef = useRef<HTMLDivElement | null>(null);

  const observationSummary = patientRecord?.data.observations.slice(0, 4).map((observation, index) => {
    const label =
      observation.code?.text ||
      observation.code?.coding?.[0]?.display ||
      observation.code?.coding?.[0]?.code ||
      `Observation ${index + 1}`;

    if (observation.component?.length) {
      const parts = observation.component
        .map((component) => {
          const componentLabel =
            component.code?.text ||
            component.code?.coding?.[0]?.display ||
            component.code?.coding?.[0]?.code ||
            'component';
          const componentValue = component.valueQuantity?.value;
          const componentUnit = component.valueQuantity?.unit || '';
          return componentValue != null ? `${componentLabel}: ${componentValue}${componentUnit}` : componentLabel;
        })
        .join(' | ');
      return `${label} - ${parts}`;
    }

    if (observation.valueQuantity?.value != null) {
      return `${label} - ${observation.valueQuantity.value}${observation.valueQuantity.unit || ''}`;
    }

    if (observation.valueString) {
      return `${label} - ${observation.valueString}`;
    }

    if (observation.valueCodeableConcept?.text) {
      return `${label} - ${observation.valueCodeableConcept.text}`;
    }

    return label;
  }) ?? [];

  const conditionSummary = patientRecord?.data.conditions.slice(0, 3).map((condition, index) => (
    condition.code?.text ||
    condition.code?.coding?.[0]?.display ||
    condition.code?.coding?.[0]?.code ||
    `Condition ${index + 1}`
  )) ?? [];
  const medicationSummary = patientRecord?.data.medications.slice(0, 3).map((medication, index) => (
    medication.medicationCodeableConcept?.text || `Medication ${index + 1}`
  )) ?? [];

  useEffect(() => {
    messageBoxRef.current?.scrollTo({
      top: messageBoxRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  useEffect(() => {
    async function bootstrap() {
      setLoading((current) => ({ ...current, boot: true }));
      setErrorText('');

      try {
        const [serviceHealth, doctorDirectory, patientSnapshot] = await Promise.all([
          requestJson<HealthCheck>('/dev/health-check'),
          requestJson<DoctorDirectoryEntry[]>('/dev/doctors'),
          requestJson<Snapshot>(`/dev/patient/${encodeURIComponent(patientId)}`),
        ]);

        setHealthCheck(serviceHealth);
        setDirectory(doctorDirectory);
        setSnapshot(patientSnapshot);
        setPatientRecord(patientSnapshot);
        setStatusText('Backend connected. Ready for live requests.');
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : 'Backend unavailable.');
        setStatusText('Backend connection failed.');
      } finally {
        setLoading((current) => ({ ...current, boot: false }));
      }
    }

    void bootstrap();
  }, [patientId]);

  async function sendChat() {
    const trimmed = chatInput.trim();
    if (!trimmed || loading.chat) return;

    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, text: trimmed, sender: 'user' },
    ]);
    setChatInput('');
    setLoading((current) => ({ ...current, chat: true }));
    setErrorText('');
    setStatusText('Calling chat endpoint...');

    try {
      const query = new URLSearchParams({
        message: trimmed,
        patient_id: patientId,
      });
      const response = await requestJson<ChatResponse>(`/dev/chat?${query.toString()}`, {
        method: 'POST',
      });

      if (response.data?.conversation_id) {
        setConversationId(response.data.conversation_id);
      }
      if (response.data?.analysis_result) {
        setAnalysis(response.data.analysis_result);
      }
      if (response.data?.upload_result) {
        setUpload(response.data.upload_result);
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          text: response.data?.assistant_message || response.message,
          sender: 'ai',
        },
      ]);
      setStatusText('Chat response received.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Chat failed.';
      setErrorText(message);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          text: `Backend error: ${message}`,
          sender: 'ai',
        },
      ]);
      setStatusText('Chat request failed.');
    } finally {
      setLoading((current) => ({ ...current, chat: false }));
    }
  }

  async function uploadVitals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading.upload) return;

    setLoading((current) => ({ ...current, upload: true }));
    setErrorText('');
    setStatusText('Uploading structured health data...');

    try {
      const query = new URLSearchParams({
        message: 'Please record my latest vitals and update my profile.',
        patient_id: patientId,
        blood_pressure_systolic: healthForm.systolic || '0',
        blood_pressure_diastolic: healthForm.diastolic || '0',
        heart_rate: healthForm.heartRate || '0',
      });

      if (healthForm.glucose.trim()) {
        query.set('glucose', healthForm.glucose.trim());
      }
      if (healthForm.symptoms.trim()) {
        query.set('symptoms', healthForm.symptoms.trim());
      }

      const response = await requestJson<ChatResponse>(`/dev/chat/with-data?${query.toString()}`, {
        method: 'POST',
      });

      if (response.data?.conversation_id) {
        setConversationId(response.data.conversation_id);
      }
      if (response.data?.analysis_result) {
        setAnalysis(response.data.analysis_result);
      }
      if (response.data?.upload_result) {
        setUpload(response.data.upload_result);
      }
      if (response.data?.assistant_message) {
        setMessages((current) => [
          ...current,
          {
            id: `upload-${Date.now()}`,
            text: response.data!.assistant_message,
            sender: 'ai',
          },
        ]);
      }

      const patientSnapshot = await requestJson<Snapshot>(`/dev/patient/${encodeURIComponent(patientId)}`);
      setSnapshot(patientSnapshot);
        setPatientRecord(patientSnapshot);
      setStatusText('Health data uploaded.');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Upload failed.');
      setStatusText('Health data upload failed.');
    } finally {
      setLoading((current) => ({ ...current, upload: false }));
    }
  }

  async function runMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading.match) return;

    setLoading((current) => ({ ...current, match: true }));
    setErrorText('');
    setStatusText('Running doctor matching...');

    try {
      const query = new URLSearchParams({
        patient_id: patientId,
        top_k: filters.topK || '5',
      });

      if (filters.condition.trim()) {
        query.set('condition_category', filters.condition.trim());
      }
      if (filters.location.trim()) {
        query.set('location', filters.location.trim());
      }
      if (filters.maxFee.trim()) {
        query.set('max_fee', filters.maxFee.trim());
      }

      const response = await requestJson<{ matches: Match[]; message: string }>(`/dev/match-doctors?${query.toString()}`, {
        method: 'POST',
      });

      setMatches(response.matches);
      setStatusText(response.message);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Doctor matching failed.');
      setStatusText('Doctor matching failed.');
    } finally {
      setLoading((current) => ({ ...current, match: false }));
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#f5fbf8_0%,#eef6ff_45%,#fffaf0_100%)] text-slate-900">
      <header className="sticky top-0 z-10 border-b border-white/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500 p-3 text-white">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">CS-6440 Care Match</p>
              <h1 className="text-2xl font-bold tracking-tight">Medical Profile & Matchmaking Portal</h1>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">API Base</p>
            <p className="max-w-[240px] truncate text-sm font-medium text-slate-700">{API_BASE}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-6 xl:grid-cols-12">
        <section className="space-y-6 xl:col-span-3">
          <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-slate-200/60">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Patient Context</p>
            <input
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
            />
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-slate-50 px-3 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Obs</p>
                <p className="mt-1 text-2xl font-bold">{snapshot?.observations_count ?? '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Cond</p>
                <p className="mt-1 text-2xl font-bold">{snapshot?.conditions_count ?? '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Rx</p>
                <p className="mt-1 text-2xl font-bold">{snapshot?.medications_count ?? '-'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-slate-200/60">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Patient Details</p>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Observations</p>
                <div className="space-y-2">
                  {observationSummary.length ? observationSummary.map((item) => (
                    <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">{item}</div>
                  )) : <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-500">No observations loaded for this patient.</div>}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Conditions</p>
                <div className="flex flex-wrap gap-2">
                  {conditionSummary.length ? conditionSummary.map((item) => (
                    <span key={item} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{item}</span>
                  )) : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">None yet</span>}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Medications</p>
                <div className="flex flex-wrap gap-2">
                  {medicationSummary.length ? medicationSummary.map((item) => (
                    <span key={item} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">{item}</span>
                  )) : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">None yet</span>}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-slate-200/60">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Service Health</p>
            </div>
            <div className="space-y-3 text-sm">
              {healthCheck ? (
                Object.entries(healthCheck).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="capitalize text-slate-700">{key.replace('_', ' ')}</span>
                    <span className="text-xs font-semibold text-slate-600">{value}</span>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-500">No status loaded.</p>
              )}
            </div>
          </div>

          <form onSubmit={uploadVitals} className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-slate-200/60">
            <div className="mb-3 flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-rose-600" />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Upload Health Data</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={healthForm.systolic}
                onChange={(event) => setHealthForm((current) => ({ ...current, systolic: event.target.value }))}
                placeholder="Systolic"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
              />
              <input
                value={healthForm.diastolic}
                onChange={(event) => setHealthForm((current) => ({ ...current, diastolic: event.target.value }))}
                placeholder="Diastolic"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
              />
              <input
                value={healthForm.heartRate}
                onChange={(event) => setHealthForm((current) => ({ ...current, heartRate: event.target.value }))}
                placeholder="Heart rate"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
              />
              <input
                value={healthForm.glucose}
                onChange={(event) => setHealthForm((current) => ({ ...current, glucose: event.target.value }))}
                placeholder="Glucose"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
              />
            </div>
            <textarea
              value={healthForm.symptoms}
              onChange={(event) => setHealthForm((current) => ({ ...current, symptoms: event.target.value }))}
              placeholder="Symptoms, comma separated"
              rows={3}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
            />
            <button
              type="submit"
              disabled={loading.upload}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
            >
              {loading.upload ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              Upload To Backend
            </button>
          </form>
        </section>

        <section className="flex min-h-[720px] flex-col rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-slate-200/60 xl:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Consult</p>
              <h2 className="text-2xl font-bold">Live Chat + Analysis</h2>
            </div>
            {conversationId ? (
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{conversationId.slice(0, 8)}</div>
            ) : null}
          </div>
          <div
            ref={messageBoxRef}
            className="custom-scrollbar mb-4 flex-1 space-y-5 overflow-y-auto rounded-[28px] bg-[radial-gradient(circle_at_top,#f8fbff,white_52%)] p-5"
          >
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-3xl px-4 py-3 shadow-sm ${
                      message.sender === 'user'
                        ? 'bg-emerald-500 text-white'
                        : 'border border-sky-100 bg-sky-50 text-slate-800'
                    }`}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] opacity-75">
                      {message.sender === 'user' ? 'Patient' : 'Assistant'}
                    </p>
                    <p className="text-sm leading-6">{message.text}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
              <MessageSquare className="h-4 w-4" />
              <span>{statusText}</span>
            </div>
            <div className="flex gap-3">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void sendChat();
                  }
                }}
                placeholder="Describe symptoms, concerns, or specialist needs"
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
              <button
                onClick={() => void sendChat()}
                disabled={loading.chat}
                className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:bg-emerald-300"
              >
                {loading.chat ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Analysis</p>
              {analysis ? (
                <>
                  <p className="text-sm font-semibold text-slate-800">{analysis.overall_risk_level} risk</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{analysis.overall_summary}</p>
                  <div className="mt-3 space-y-2">
                    {analysis.conditions.slice(0, 2).map((condition) => (
                      <div key={`${condition.category}-${condition.condition_name}`} className="rounded-2xl bg-slate-50 p-3">
                        <p className="font-semibold">{condition.condition_name}</p>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{condition.category}</p>
                        <p className="mt-1 text-sm text-slate-600">{condition.description}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm leading-6 text-slate-500">Run chat or upload vitals to show structured analysis.</p>
              )}
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Upload Result</p>
              {upload ? (
                <>
                  <p className="text-3xl font-bold">{upload.resources_created}</p>
                  <p className="mt-1 text-sm text-slate-600">FHIR resources created.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {upload.resource_types.map((type, index) => (
                      <span key={`${type}-${index}`} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {type}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm leading-6 text-slate-500">No upload response yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-6 xl:col-span-4">
          <form onSubmit={runMatch} className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-slate-200/60">
            <div className="mb-3 flex items-center gap-2">
              <Search className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Doctor Filters</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={filters.condition}
                onChange={(event) => setFilters((current) => ({ ...current, condition: event.target.value }))}
                placeholder="Condition category"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
              />
              <input
                value={filters.location}
                onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
                placeholder="Location"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
              />
              <input
                value={filters.maxFee}
                onChange={(event) => setFilters((current) => ({ ...current, maxFee: event.target.value }))}
                placeholder="Max fee"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
              />
              <input
                value={filters.topK}
                onChange={(event) => setFilters((current) => ({ ...current, topK: event.target.value }))}
                placeholder="Top K"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading.match}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:bg-emerald-300"
            >
              {loading.match ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Run Doctor Match
            </button>
          </form>

          <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-slate-200/60">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Top Matches</p>
            <div className="custom-scrollbar max-h-[470px] space-y-4 overflow-y-auto pr-1">
              {matches.length ? (
                matches.map((doctor) => (
                  <motion.div key={doctor.doctor_id} whileHover={{ scale: 1.01 }} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex gap-4">
                      <img
                        src={`https://api.dicebear.com/9.x/initials/svg?seed=${avatarSeed(doctor.name)}`}
                        alt={doctor.name}
                        className="h-16 w-16 rounded-2xl border border-slate-200 bg-slate-50"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold">{doctor.name}</h3>
                            <p className="text-sm text-slate-600">
                              {doctor.specialty}
                              {doctor.sub_specialty ? ` · ${doctor.sub_specialty}` : ''}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-right">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-700">Fit</p>
                            <p className="text-lg font-bold text-emerald-800">{Math.round(doctor.similarity_score * 100)}%</p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{doctor.expertise_description}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                          <span className="rounded-full bg-slate-100 px-3 py-1">{formatMoney(doctor.consultation_fee)}</span>
                          {doctor.location ? <span className="rounded-full bg-slate-100 px-3 py-1">{doctor.location}</span> : null}
                          {doctor.matched_skill ? (
                            <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">matched on {doctor.matched_skill}</span>
                          ) : null}
                        </div>
                        {doctor.match_reasons.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {doctor.match_reasons.slice(0, 3).map((reason) => (
                              <span key={reason} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                                {reason}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button className="flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Message
                          </button>
                          <button className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                            <Calendar className="h-3.5 w-3.5" />
                            Book
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm leading-6 text-slate-500">
                  Run matching to load live backend results.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-slate-200/60">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Doctor Directory</p>
            <div className="custom-scrollbar max-h-[240px] space-y-3 overflow-y-auto pr-1">
              {directory.length ? (
                directory.map((doctor) => (
                  <div key={doctor.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="font-semibold">{doctor.name}</p>
                    <p className="text-sm text-slate-600">{doctor.specialty}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {doctor.location ?? 'Location TBD'} · {formatMoney(doctor.consultation_fee)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">No doctors returned by /dev/doctors.</p>
              )}
            </div>
          </div>
        </section>
      </main>

      {(loading.boot || errorText) ? (
        <div className="fixed bottom-4 left-1/2 z-20 w-[min(92vw,720px)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-3">
            {loading.boot ? <LoaderCircle className="h-5 w-5 animate-spin text-emerald-600" /> : <Stethoscope className="h-5 w-5 text-rose-600" />}
            <p className="text-sm text-slate-700">
              {loading.boot ? 'Loading backend status, patient snapshot, and doctor directory...' : errorText}
            </p>
          </div>
        </div>
      ) : null}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 7px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.45);
          border-radius: 999px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.55);
        }
      `}</style>
    </div>
  );
}





