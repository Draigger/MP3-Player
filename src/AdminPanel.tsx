import { useState, useRef } from 'react';
import { X, Music, Image, Save, Loader2, Trash2, Edit3, Plus, Copy, Check, AlertCircle } from 'lucide-react';
import { supabase, SETUP_SQL } from './lib/supabase';
import type { Track } from './lib/supabase';

interface Props {
  tracks: Track[];
  onClose: () => void;
  onRefresh: () => void;
  dbReady: boolean;
}

type FormData = {
  title: string;
  artist: string;
  album: string;
  duration: string;
  cover_url: string;
  audio_url: string;
  sort_order: string;
};

const EMPTY_FORM: FormData = {
  title: '', artist: '', album: '', duration: '', cover_url: '', audio_url: '', sort_order: '',
};

function durationToSeconds(val: string): number {
  if (val.includes(':')) {
    const [m, s] = val.split(':').map(Number);
    return (m || 0) * 60 + (s || 0);
  }
  return parseInt(val) || 0;
}

function secondsToDisplay(s: number): string {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AdminPanel({ tracks, onClose, onRefresh, dbReady }: Props) {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(!dbReady);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof FormData, val: string) => setForm(f => ({ ...f, [key]: val }));

  const startEdit = (t: Track) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration: secondsToDisplay(t.duration),
      cover_url: t.cover_url,
      audio_url: t.audio_url,
      sort_order: String(t.sort_order),
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const uploadFile = async (
    file: File,
    folder: 'covers' | 'audio',
    setter: (v: boolean) => void,
    urlKey: 'cover_url' | 'audio_url',
  ) => {
    setter(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop();
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('tracks-media')
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from('tracks-media').getPublicUrl(path);
      set(urlKey, data.publicUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setter(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.artist.trim()) {
      setError('Title and artist are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      artist: form.artist.trim(),
      album: form.album.trim(),
      duration: durationToSeconds(form.duration),
      cover_url: form.cover_url.trim(),
      audio_url: form.audio_url.trim(),
      sort_order: parseInt(form.sort_order) || 0,
    };
    try {
      if (editingId) {
        const { error: e } = await supabase.from('tracks').update(payload).eq('id', editingId);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('tracks').insert(payload);
        if (e) throw e;
      }
      cancelEdit();
      onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error: e } = await supabase.from('tracks').delete().eq('id', id);
    if (e) setError(e.message);
    else onRefresh();
    setDeleting(null);
  };

  const copySql = () => {
    navigator.clipboard.writeText(SETUP_SQL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="relative w-full sm:max-w-3xl bg-[#13131f] sm:rounded-2xl border border-white/10
                      flex flex-col max-h-screen sm:max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <h2 className="text-base font-semibold">Manage Tracks</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* DB Setup notice */}
          {!dbReady && (
            <div className="mx-5 mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <AlertCircle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-300">Database table not found</p>
                  <p className="text-xs text-white/50 mt-1">
                    Run the setup SQL in your Supabase SQL Editor to create the tracks table and storage bucket.
                  </p>

                  <button
                    onClick={() => setShowSql(s => !s)}
                    className="text-xs text-amber-400/60 hover:text-amber-400 mt-3 underline block"
                  >
                    {showSql ? 'Hide' : 'Show'} setup SQL
                  </button>
                  {showSql && (
                    <div className="mt-3 relative">
                      <pre className="text-[10px] text-white/60 bg-black/40 rounded-lg p-3 overflow-x-auto max-h-48 leading-relaxed whitespace-pre-wrap">
                        {SETUP_SQL}
                      </pre>
                      <button
                        onClick={copySql}
                        className="absolute top-2 right-2 flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20
                                   px-2 py-1 rounded-md transition-colors"
                      >
                        {copied ? <Check size={11} /> : <Copy size={11} />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="px-5 py-4 border-b border-white/8">
            <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
              {editingId ? <><Edit3 size={13} /> Edit track</> : <><Plus size={13} /> Add new track</>}
            </h3>

            {error && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Title */}
              <div>
                <label className="label">Title *</label>
                <input className="field" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Track title" />
              </div>
              {/* Artist */}
              <div>
                <label className="label">Artist *</label>
                <input className="field" value={form.artist} onChange={e => set('artist', e.target.value)} placeholder="Artist name" />
              </div>
              {/* Album */}
              <div>
                <label className="label">Album</label>
                <input className="field" value={form.album} onChange={e => set('album', e.target.value)} placeholder="Album name" />
              </div>
              {/* Duration */}
              <div>
                <label className="label">Duration (m:ss)</label>
                <input className="field" value={form.duration} onChange={e => set('duration', e.target.value)} placeholder="3:45" />
              </div>
              {/* Sort order */}
              <div>
                <label className="label">Sort order</label>
                <input className="field" type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} placeholder="1" />
              </div>
            </div>

            {/* Cover URL + upload */}
            <div className="mt-3">
              <label className="label">Cover image URL</label>
              <div className="flex gap-2">
                <input className="field flex-1" value={form.cover_url} onChange={e => set('cover_url', e.target.value)} placeholder="https://..." />
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, 'covers', setUploadingCover, 'cover_url'); }} />
                <button
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="upload-btn"
                >
                  {uploadingCover ? <Loader2 size={14} className="animate-spin" /> : <Image size={14} />}
                  <span className="hidden sm:inline">{uploadingCover ? 'Uploading…' : 'Upload'}</span>
                </button>
              </div>
              {form.cover_url && (
                <img src={form.cover_url} alt="" className="mt-2 w-16 h-16 rounded-lg object-cover border border-white/10" />
              )}
            </div>

            {/* Audio URL + upload */}
            <div className="mt-3">
              <label className="label">Audio file URL</label>
              <div className="flex gap-2">
                <input className="field flex-1" value={form.audio_url} onChange={e => set('audio_url', e.target.value)} placeholder="https://..." />
                <input ref={audioInputRef} type="file" accept="audio/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, 'audio', setUploadingAudio, 'audio_url'); }} />
                <button
                  onClick={() => audioInputRef.current?.click()}
                  disabled={uploadingAudio}
                  className="upload-btn"
                >
                  {uploadingAudio ? <Loader2 size={14} className="animate-spin" /> : <Music size={14} />}
                  <span className="hidden sm:inline">{uploadingAudio ? 'Uploading…' : 'Upload'}</span>
                </button>
              </div>
              {form.audio_url && (
                <p className="mt-1 text-xs text-white/40 truncate">{form.audio_url}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSave}
                disabled={saving || !dbReady}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50
                           text-black text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {editingId ? 'Update' : 'Add Track'}
              </button>
              {editingId && (
                <button onClick={cancelEdit} className="px-4 py-2 text-sm text-white/50 hover:text-white border border-white/10
                                                        hover:border-white/25 rounded-lg transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Track list */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-white/40 uppercase tracking-widest mb-3">{tracks.length} tracks</p>
            {tracks.length === 0 && (
              <p className="text-sm text-white/30 text-center py-8">No tracks yet. Add one above.</p>
            )}
            <div className="space-y-2">
              {tracks.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  {t.cover_url
                    ? <img src={t.cover_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    : <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <Music size={14} className="text-white/30" />
                      </div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-white/40 truncate">{t.artist} — {t.album}</p>
                    {t.audio_url
                      ? <p className="text-[10px] text-cyan-500/70 mt-0.5">Audio attached</p>
                      : <p className="text-[10px] text-white/25 mt-0.5">No audio file</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(t)}
                      className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deleting === t.id}
                      className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                    >
                      {deleting === t.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
