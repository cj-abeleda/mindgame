'use client';

import { useState, useRef, useEffect, useMemo, useSyncExternalStore } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Profile {
  sport: string;
  position: string;
  level: string;
  onMind: string;
}

const PROFILE_KEY = 'mindgame.profile';
const COMPLETED_SESSIONS_KEY = 'mindgame.completedSessions';
const SESSIONS_KEY = 'mindgame.sessions';
const MAX_SESSIONS = 5;

interface SessionNotes {
  id: string;
  date: string;
  pattern: string;
  summary: string;
  mentalModel: string;
  cue: string;
  returnPrompt: string;
}
const ON_MIND_MAX = 500;
const POSITIONS = ['Guard', 'Wing', 'Big', 'Not sure'];
const LEVELS = [
  'Pickup / casual',
  'Rec league',
  'Competitive adult league',
  'Former college/pro, still playing',
];

// Profile store backed by localStorage, read through useSyncExternalStore so the
// server render (no localStorage) and the first client render agree.
const profileListeners = new Set<() => void>();
let memoryProfile: string | null = null; // used when localStorage is blocked

function subscribeProfile(callback: () => void) {
  profileListeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    profileListeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

function readStoredProfile(): string | null {
  try {
    return localStorage.getItem(PROFILE_KEY) ?? memoryProfile;
  } catch {
    return memoryProfile;
  }
}

function writeStoredProfile(profile: Profile) {
  const raw = JSON.stringify(profile);
  memoryProfile = raw;
  try {
    localStorage.setItem(PROFILE_KEY, raw);
  } catch {
    // Storage blocked (e.g. private mode): the profile still works for this visit.
  }
  profileListeners.forEach((listener) => listener());
}

// A session counts as completed once the athlete has sent at least one message in it.
let memoryCompletedSessions = 0; // used when localStorage is blocked

function readCompletedSessions(): number {
  try {
    const n = Number(localStorage.getItem(COMPLETED_SESSIONS_KEY));
    return Number.isFinite(n) && n > 0 ? n : memoryCompletedSessions;
  } catch {
    return memoryCompletedSessions;
  }
}

function markSessionCompleted() {
  memoryCompletedSessions = readCompletedSessions() + 1;
  try {
    localStorage.setItem(COMPLETED_SESSIONS_KEY, String(memoryCompletedSessions));
  } catch {
    // Storage blocked: counted for this visit only.
  }
}

// Angus's notes for the athlete's most recent sessions, oldest first.
let memorySessions: SessionNotes[] = []; // used when localStorage is blocked

function readSessionHistory(): SessionNotes[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return memorySessions;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.id === 'string') : memorySessions;
  } catch {
    return memorySessions;
  }
}

function saveSessionNotes(notes: SessionNotes) {
  const sessions = [...readSessionHistory()];
  const existing = sessions.findIndex((s) => s.id === notes.id);
  if (existing >= 0) sessions[existing] = notes; // same session: replace with the newer notes
  else sessions.push(notes);
  memorySessions = sessions.slice(-MAX_SESSIONS);
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(memorySessions));
  } catch {
    // Storage blocked: notes last for this visit only.
  }
}

function newSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function parseProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    const fields = [p?.sport, p?.position, p?.level, p?.onMind];
    if (fields.every((f) => typeof f === 'string' && f.trim())) return p as Profile;
  } catch {
    // Corrupt value: treat as a new user.
  }
  return null;
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: '#6b6b8a',
  fontFamily: 'monospace',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  marginBottom: '8px',
};

const fieldInput: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: '#12121a',
  border: '1px solid #1e1e2e',
  borderRadius: '12px',
  padding: '12px 16px',
  color: '#e8e8f0',
  fontSize: '16px',
  fontFamily: 'Georgia, serif',
  outline: 'none',
  lineHeight: '1.6',
};

function Onboarding({
  initial,
  onSave,
  onCancel,
}: {
  initial: Profile | null;
  onSave: (profile: Profile) => void;
  onCancel?: () => void;
}) {
  const initialIsBasketball = !initial || initial.sport === 'Basketball';
  const [sportChoice, setSportChoice] = useState(initialIsBasketball ? 'Basketball' : 'Other');
  const [otherSport, setOtherSport] = useState(initialIsBasketball ? '' : initial?.sport ?? '');
  const [position, setPosition] = useState(initial?.position ?? '');
  const [level, setLevel] = useState(initial?.level ?? '');
  const [onMind, setOnMind] = useState(initial?.onMind ?? '');

  const isBasketball = sportChoice === 'Basketball';
  const sport = isBasketball ? 'Basketball' : otherSport.trim();
  const canSubmit = !!(sport && position.trim() && level && onMind.trim());

  const changeSport = (choice: string) => {
    setSportChoice(choice);
    // Basketball positions don't carry over to another sport, and vice versa.
    setPosition('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave({ sport, position: position.trim(), level, onMind: onMind.trim() });
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
        width: '100%',
        maxWidth: '520px',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '6px' }}>
          {initial ? 'Your profile' : 'Before we start'}
        </div>
        <div style={{ fontSize: '15px', lineHeight: 1.6, color: '#a8a8c8' }}>
          A few things so Angus knows who he&apos;s working with.
        </div>
      </div>

      <div>
        <label htmlFor="sport" style={fieldLabel}>Sport</label>
        <select id="sport" value={sportChoice} onChange={(e) => changeSport(e.target.value)} style={fieldInput}>
          <option value="Basketball">Basketball</option>
          <option value="Other">Other</option>
        </select>
        {!isBasketball && (
          <input
            aria-label="Your sport"
            value={otherSport}
            onChange={(e) => setOtherSport(e.target.value)}
            placeholder="Which sport?"
            maxLength={60}
            style={{ ...fieldInput, marginTop: '10px' }}
          />
        )}
      </div>

      <div>
        <label htmlFor="position" style={fieldLabel}>Position</label>
        {isBasketball ? (
          <select id="position" value={position} onChange={(e) => setPosition(e.target.value)} style={fieldInput}>
            <option value="" disabled>Choose one</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        ) : (
          <input
            id="position"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="Your position or event"
            maxLength={60}
            style={fieldInput}
          />
        )}
      </div>

      <div>
        <label htmlFor="level" style={fieldLabel}>Level</label>
        <select id="level" value={level} onChange={(e) => setLevel(e.target.value)} style={fieldInput}>
          <option value="" disabled>Choose one</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="onMind" style={fieldLabel}>What&apos;s on your mind</label>
        <textarea
          id="onMind"
          value={onMind}
          onChange={(e) => setOnMind(e.target.value)}
          placeholder="What's been getting in the way of your game?"
          maxLength={ON_MIND_MAX}
          rows={4}
          style={{ ...fieldInput, resize: 'none' }}
        />
        <div style={{ textAlign: 'right', fontSize: '11px', color: '#6b6b8a', fontFamily: 'monospace', marginTop: '6px' }}>
          {onMind.length}/{ON_MIND_MAX}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              color: '#a8a8c8',
              border: '1px solid #2e2e4e',
              borderRadius: '12px',
              padding: '14px 20px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
            }}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            flex: 2,
            backgroundColor: '#e8ff47',
            color: '#0a0a0f',
            border: 'none',
            borderRadius: '12px',
            padding: '14px 20px',
            fontWeight: 700,
            fontSize: '14px',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: canSubmit ? 1 : 0.5,
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}
        >
          {initial ? 'Save' : 'Start session'}
        </button>
      </div>
    </form>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true); // true until Angus's opening message arrives
  const [isEditing, setIsEditing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionStarted = useRef(false);
  // Fixed when the session starts: has this athlete completed a session with Angus before?
  const isReturning = useRef(false);
  const sessionCounted = useRef(false);
  // This session's id and the notes from earlier sessions, both fixed when the session starts.
  const sessionId = useRef('');
  const pastSessions = useRef<SessionNotes[]>([]);
  const latestNotesRequest = useRef(0);

  // undefined during the server render, then the stored string (or null) in the browser.
  const storedProfile = useSyncExternalStore(subscribeProfile, readStoredProfile, () => undefined);
  const profile = useMemo(() => parseProfile(storedProfile ?? null), [storedProfile]);
  const view = storedProfile === undefined ? 'loading' : !profile || isEditing ? 'onboarding' : 'chat';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, view]);

  const handleSaveProfile = (next: Profile) => {
    // Editing mid-session keeps the conversation; the new profile applies from the next message.
    writeStoredProfile(next);
    setIsEditing(false);
  };

  const startSession = async (activeProfile: Profile) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Start the session.',
          },
        ],
        profile: activeProfile,
        returning: isReturning.current,
        history: pastSessions.current,
      }),
    });
    const data = await response.json();
    setMessages([{ role: 'assistant', content: data.message }]);
    setIsLoading(false);
  };

  // Angus opens the session once a profile exists (straight away for returning users).
  useEffect(() => {
    if (view !== 'chat' || !profile || sessionStarted.current) return;
    sessionStarted.current = true;
    isReturning.current = readCompletedSessions() > 0;
    sessionId.current = newSessionId();
    pastSessions.current = readSessionHistory();
    startSession(profile);
  }, [view, profile]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    if (!sessionCounted.current) {
      sessionCounted.current = true;
      markSessionCompleted();
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: updatedMessages,
        profile,
        returning: isReturning.current,
        history: pastSessions.current,
      }),
    });

    const data = await response.json();
    const withReply: Message[] = [...updatedMessages, { role: 'assistant', content: data.message }];
    setMessages(withReply);
    setIsLoading(false);
    if (typeof data.message === 'string') updateSessionNotes(withReply);
  };

  // Refreshes this session's notes in the background after each of Angus's replies.
  const updateSessionNotes = async (transcript: Message[]) => {
    const requestNumber = ++latestNotesRequest.current;
    const id = sessionId.current;
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: transcript }),
      });
      if (!response.ok) return;
      const { notes } = await response.json();
      // Ignore a slower, older summary arriving after a newer one.
      if (!notes || requestNumber !== latestNotesRequest.current) return;
      saveSessionNotes({ ...notes, id, date: new Date().toISOString() });
    } catch {
      // Notes are best-effort; the next reply will try again.
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#0a0a0f',
      color: '#e8e8f0',
      fontFamily: 'Georgia, serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #1e1e2e',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: '#1e1e2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
        }}>🧠</div>
        <div>
          <div style={{ fontWeight: '700', fontSize: '15px', letterSpacing: '-0.01em' }}>Angus</div>
          <div style={{ fontSize: '11px', color: '#6b6b8a', fontFamily: 'monospace' }}>Mental Performance Consultant</div>
        </div>
        {view === 'chat' && profile && (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              marginLeft: 'auto',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              backgroundColor: 'transparent',
              color: '#a8a8c8',
              border: '1px solid #2e2e4e',
              borderRadius: '999px',
              padding: '6px 12px',
              fontSize: '11px',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
              cursor: 'pointer',
            }}
          >
            Edit profile
          </button>
        )}
      </div>

      {view === 'onboarding' && (
        <Onboarding
          initial={profile}
          onSave={handleSaveProfile}
          onCancel={profile ? () => setIsEditing(false) : undefined}
        />
      )}

      {view === 'chat' && (<>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        {messages.map((message, index) => (
          <div key={index} style={{
            display: 'flex',
            justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '75%',
              padding: '14px 18px',
              borderRadius: message.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              backgroundColor: message.role === 'user' ? '#1e1e2e' : '#12121a',
              border: '1px solid',
              borderColor: message.role === 'user' ? '#2e2e4e' : '#1e1e2e',
              fontSize: '15px',
              lineHeight: '1.7',
              color: message.role === 'user' ? '#a8a8c8' : '#e8e8f0',
            }}>
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '14px 18px',
              borderRadius: '18px 18px 18px 4px',
              backgroundColor: '#12121a',
              border: '1px solid #1e1e2e',
              color: '#6b6b8a',
              fontFamily: 'monospace',
              fontSize: '13px',
            }}>
              ...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '20px 24px',
        borderTop: '1px solid #1e1e2e',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-end',
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell Angus what's been getting in the way of your game..."
          rows={2}
          style={{
            flex: 1,
            backgroundColor: '#12121a',
            border: '1px solid #1e1e2e',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#e8e8f0',
            fontSize: '15px',
            fontFamily: 'Georgia, serif',
            resize: 'none',
            outline: 'none',
            lineHeight: '1.6',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          style={{
            backgroundColor: '#e8ff47',
            color: '#0a0a0f',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 20px',
            fontWeight: '700',
            fontSize: '14px',
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: isLoading || !input.trim() ? 0.5 : 1,
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}
        >
          Send
        </button>
      </div>
      </>)}
    </main>
  );
}