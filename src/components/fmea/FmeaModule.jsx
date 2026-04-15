import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  ArrowLeft,
  Save,
  Download,
  Trash2,
  Pencil,
  BarChart3,
  FileSpreadsheet,
  BookOpen,
  FileDown,
  ChevronDown,
  Users,
  Settings,
  AlertTriangle,
  ClipboardCheck,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { openPrintableReport } from '@/lib/reportUtils';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import FmeaSheetTable from '@/components/fmea/FmeaSheetTable';
import { computeRpn, computeApLevel, AP_LABEL_TR, apBadgeClass } from '@/lib/fmeaCalculations';
import {
  FIVE_T_KEYS,
  FIVE_T_LABELS,
  FIVE_T_OPTIONS,
  normalizeFiveTopicsObject,
} from '@/lib/fmeaFiveTopics';
import {
  mergeFmeaSettings,
  lineNeedsCpReview,
  getCpReviewReasons,
  inferTriggerTypeForFollowup,
  normalizePartCode,
} from '@/lib/fmeaSettings';
import { cn } from '@/lib/utils';

const PRESET_EMPTY = '__empty__';

const ANALYSIS_TYPES = [
  { value: 'PFMEA', label: 'PFMEA' },
  { value: 'DFMEA', label: 'DFMEA' },
  { value: 'REVERSE_PFMEA', label: 'Tersine PFMEA' },
  { value: 'LFMEA', label: 'LFMEA' },
  { value: 'MFMEA', label: 'MFMEA' },
  { value: 'SFMEA', label: 'SFMEA' },
  { value: 'SWFMEA', label: 'SWFMEA' },
  { value: 'UFMEA', label: 'UFMEA' },
];

const STANDARDS = [
  { value: 'AIAG_VDA', label: 'AIAG & VDA' },
  { value: 'AIAG', label: 'AIAG' },
  { value: 'VDA', label: 'VDA' },
];

/** Veritabanı status değerleri (mevcut KPI / şema ile uyumlu) */
const STATUS_OPTS = [
  { value: 'Draft', label: 'Taslak' },
  { value: 'Active', label: 'Aktif' },
  { value: 'In Review', label: 'İncelemede' },
  { value: 'Approved', label: 'Onaylandı' },
  { value: 'Obsolete', label: 'Arşiv' },
];

function statusLabel(db) {
  return STATUS_OPTS.find((s) => s.value === db)?.label || db || '—';
}

function enrichLine(row) {
  const s = row.severity;
  const o = row.occurrence;
  const d = row.detection;
  const rpn = computeRpn(s, o, d);
  const ap = computeApLevel(s, o, d);
  const sa = row.s_after;
  const oa = row.o_after;
  const da = row.d_after;
  return {
    ...row,
    rpn,
    ap_level: ap,
    rpn_after: computeRpn(sa, oa, da),
    ap_after: computeApLevel(sa, oa, da),
  };
}

function downloadCsv(filename, rows) {
  const headers = [
    'Proses öğesi',
    'Fonksiyon',
    'Hata modu',
    'Etki',
    'S',
    'Neden',
    'O',
    'Önleme',
    'Tespit',
    'D',
    'RPN',
    'Öncelik',
    'Önerilen tedbir',
    'Sorumlu',
    'Hedef tarih',
  ];
  const esc = (v) => {
    const s = String(v ?? '');
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const linesCsv = [headers.join(';')];
  for (const r of rows) {
    linesCsv.push(
      [
        r.process_step,
        r.function_text,
        r.failure_mode,
        r.effect,
        r.severity,
        r.cause,
        r.occurrence,
        r.current_prevention,
        r.current_detection,
        r.detection,
        r.rpn,
        r.ap_level ? AP_LABEL_TR[r.ap_level] : '',
        r.recommended_action,
        r.responsible,
        r.target_date,
      ]
        .map(esc)
        .join(';')
    );
  }
  const blob = new Blob(['\ufeff' + linesCsv.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function FmeaModule() {
  const { user, profile } = useAuth();
  const { personnel } = useData();
  const { toast } = useToast();
  const perm = profile?.permissions?.fmea;
  const canEdit = Boolean(user && perm !== 'read' && perm !== 'none');

  const [projects, setProjects] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [listStatusFilter, setListStatusFilter] = useState('all');
  const [sheetLineFilter, setSheetLineFilter] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [project, setProject] = useState(null);
  const [lines, setLines] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [fiveDialogOpen, setFiveDialogOpen] = useState(false);
  const [teamMemberSearch, setTeamMemberSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const [fmeaSettings, setFmeaSettings] = useState(() => mergeFmeaSettings(null));
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(null);

  const [followups, setFollowups] = useState([]);
  const [workTab, setWorkTab] = useState('sheet');
  const [cpSaveAlertOpen, setCpSaveAlertOpen] = useState(false);
  const [cpSaveAlertLines, setCpSaveAlertLines] = useState([]);

  const [addFollowupOpen, setAddFollowupOpen] = useState(false);
  const [incomingPlansForCp, setIncomingPlansForCp] = useState([]);
  const [processPlansForCp, setProcessPlansForCp] = useState([]);
  const [followupKind, setFollowupKind] = useState('incoming');
  const [followupPlanId, setFollowupPlanId] = useState('');
  const [followupLineId, setFollowupLineId] = useState('');
  const [followupNote, setFollowupNote] = useState('');
  const [savingFollowup, setSavingFollowup] = useState(false);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveTargetId, setResolveTargetId] = useState(null);
  const [resolveNote, setResolveNote] = useState('');

  useEffect(() => {
    if (projectDialogOpen) setTeamMemberSearch('');
  }, [projectDialogOpen]);

  const loadFmeaSettings = useCallback(async () => {
    const { data, error } = await supabase.from('fmea_app_settings').select('*').eq('id', 1).maybeSingle();
    if (error) {
      console.warn('FMEA ayarları yüklenemedi', error.message);
      setFmeaSettings(mergeFmeaSettings(null));
      return;
    }
    setFmeaSettings(mergeFmeaSettings(data));
  }, []);

  useEffect(() => {
    loadFmeaSettings();
  }, [loadFmeaSettings]);

  useEffect(() => {
    if (!selectedId) {
      setFollowups([]);
      setAddFollowupOpen(false);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!addFollowupOpen) return;
    (async () => {
      const [inc, proc] = await Promise.all([
        supabase
          .from('incoming_control_plans')
          .select('id, part_code, part_name, plan_name')
          .eq('is_current', true)
          .order('part_code'),
        supabase.from('process_control_plans').select('id, part_code, part_name, plan_name').eq('is_active', true).order('part_code'),
      ]);
      setIncomingPlansForCp(inc.data || []);
      setProcessPlansForCp(proc.data || []);
    })();
  }, [addFollowupOpen]);

  const filteredTeamPersonnel = useMemo(() => {
    const q = teamMemberSearch.trim().toLowerCase();
    const list = personnel || [];
    if (!q) return list;
    return list.filter((p) => (p.full_name || '').toLowerCase().includes(q));
  }, [personnel, teamMemberSearch]);

  const loadProjects = useCallback(async () => {
    setLoadingList(true);
    const { data, error } = await supabase
      .from('fmea_projects')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) {
      toast({ variant: 'destructive', title: 'Hata', description: error.message });
      setProjects([]);
    } else {
      setProjects(data || []);
    }
    setLoadingList(false);
  }, [toast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const loadDetail = useCallback(
    async (id) => {
      if (!id) return;
      setLoadingDetail(true);
      const { data: p, error: e1 } = await supabase.from('fmea_projects').select('*').eq('id', id).single();
      if (e1) {
        toast({ variant: 'destructive', title: 'Proje yüklenemedi', description: e1.message });
        setLoadingDetail(false);
        return;
      }
      const { data: ls, error: e2 } = await supabase
        .from('fmea_lines')
        .select('*')
        .eq('project_id', id)
        .order('sort_order', { ascending: true });
      if (e2) {
        toast({ variant: 'destructive', title: 'Satırlar yüklenemedi', description: e2.message });
      }
      setProject(p);
      setLines((ls || []).map(enrichLine));
      const { data: fu } = await supabase
        .from('fmea_control_plan_followups')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });
      setFollowups(fu || []);
      setLoadingDetail(false);
    },
    [toast]
  );

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const saveLines = useCallback(async () => {
    if (!selectedId || !canEdit || !lines.length) return;
    setSaving(true);
    const payload = lines.map((l, i) => ({
      id: l.id,
      project_id: selectedId,
      sort_order: i,
      process_step: l.process_step,
      function_text: l.function_text,
      failure_mode: l.failure_mode,
      effect: l.effect,
      severity: l.severity,
      cause: l.cause,
      occurrence: l.occurrence,
      current_prevention: l.current_prevention,
      current_detection: l.current_detection,
      detection: l.detection,
      rpn: l.rpn,
      ap_level: l.ap_level,
      recommended_action: l.recommended_action,
      responsible: l.responsible,
      target_date: l.target_date || null,
      actions_taken: l.actions_taken,
      line_status: l.line_status,
      s_after: l.s_after,
      o_after: l.o_after,
      d_after: l.d_after,
      rpn_after: l.rpn_after,
      ap_after: l.ap_after,
      is_active: l.is_active,
      cp_integration_note: l.cp_integration_note,
    }));
    const { error } = await supabase.from('fmea_lines').upsert(payload, { onConflict: 'id' });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Kaydedilemedi', description: error.message });
      return;
    }
    toast({ title: 'Satırlar kaydedildi', description: 'FMEA çalışma sayfası güncellendi.' });
    loadProjects();
    const { data: fu } = await supabase
      .from('fmea_control_plan_followups')
      .select('*')
      .eq('project_id', selectedId)
      .order('created_at', { ascending: false });
    setFollowups(fu || []);
    const needing = lines.filter((l) => l.is_active && lineNeedsCpReview(l, fmeaSettings));
    if (needing.length) {
      setCpSaveAlertLines(needing);
      setCpSaveAlertOpen(true);
    }
  }, [selectedId, canEdit, lines, toast, loadProjects, fmeaSettings]);

  const saveProjectMeta = useCallback(async () => {
    if (!editingProject?.id || !canEdit) return;
    const id = editingProject.id;
    const { error } = await supabase
      .from('fmea_projects')
      .update({
        fmea_number: editingProject.fmea_number,
        fmea_name: editingProject.fmea_name,
        fmea_type: editingProject.fmea_type,
        part_number: editingProject.part_number,
        part_name: editingProject.part_name,
        process_name: editingProject.process_name,
        status: editingProject.status,
        revision_number: editingProject.revision_number,
        revision_date: editingProject.revision_date || null,
        company_name: editingProject.company_name,
        customer_names: editingProject.customer_names || [],
        team_member_names: editingProject.team_member_names || [],
        notes: editingProject.notes,
        standard: editingProject.standard || 'AIAG_VDA',
      })
      .eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Kaydedilemedi', description: error.message });
      return;
    }
    toast({ title: 'Proje güncellendi' });
    setProjectDialogOpen(false);
    setEditingProject(null);
    if (selectedId === id) loadDetail(id);
    loadProjects();
  }, [editingProject, canEdit, toast, selectedId, loadDetail, loadProjects]);

  const createProject = useCallback(async () => {
    if (!canEdit || !user) return;
    const stamp = Date.now();
    const draft = {
      fmea_number: `FMEA-${stamp}`,
      fmea_name: 'Yeni FMEA',
      fmea_type: 'PFMEA',
      status: 'Draft',
      revision_number: 'Rev. 01',
      revision_date: new Date().toISOString().slice(0, 10),
      standard: 'AIAG_VDA',
      created_by: user.id,
    };
    const { data, error } = await supabase.from('fmea_projects').insert(draft).select().single();
    if (error) {
      toast({ variant: 'destructive', title: 'Oluşturulamadı', description: error.message });
      return;
    }
    toast({ title: 'Proje oluşturuldu' });
    await loadProjects();
    setSelectedId(data.id);
  }, [canEdit, user, toast, loadProjects]);

  const deleteProject = useCallback(async () => {
    if (!deleteId || !canEdit) return;
    const { error } = await supabase.from('fmea_projects').delete().eq('id', deleteId);
    if (error) {
      toast({ variant: 'destructive', title: 'Silinemedi', description: error.message });
      return;
    }
    toast({ title: 'Proje silindi' });
    if (selectedId === deleteId) {
      setSelectedId(null);
      setProject(null);
      setLines([]);
    }
    setDeleteId(null);
    loadProjects();
  }, [deleteId, canEdit, selectedId, toast, loadProjects]);

  const handleUpdateLine = useCallback((id, fullRow) => {
    setLines((prev) => prev.map((l) => (l.id === id ? enrichLine(fullRow) : l)));
  }, []);

  const handleAddLine = useCallback(
    async (afterSortOrder) => {
      if (!selectedId || !canEdit) return;
      const maxOrder = lines.reduce((m, l) => Math.max(m, l.sort_order ?? 0), -1);
      const insertAt = afterSortOrder != null ? afterSortOrder + 1 : maxOrder + 1;

      const toShift = lines.filter((l) => (l.sort_order ?? 0) >= insertAt);
      for (const line of toShift) {
        await supabase
          .from('fmea_lines')
          .update({ sort_order: (line.sort_order ?? 0) + 1 })
          .eq('id', line.id);
      }

      const { error } = await supabase
        .from('fmea_lines')
        .insert({
          project_id: selectedId,
          sort_order: insertAt,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        toast({ variant: 'destructive', title: 'Satır eklenemedi', description: error.message });
        return;
      }

      await loadDetail(selectedId);
      toast({ title: 'Satır eklendi' });
    },
    [selectedId, canEdit, lines, toast, loadDetail]
  );

  const handleDuplicateLine = useCallback(
    async (line) => {
      if (!selectedId || !canEdit) return;
      const max = lines.reduce((m, l) => Math.max(m, l.sort_order ?? 0), 0);
      const copy = {
        project_id: selectedId,
        sort_order: max + 1,
        process_step: line.process_step,
        function_text: line.function_text,
        failure_mode: line.failure_mode,
        effect: line.effect,
        severity: line.severity,
        cause: line.cause,
        occurrence: line.occurrence,
        current_prevention: line.current_prevention,
        current_detection: line.current_detection,
        detection: line.detection,
        recommended_action: line.recommended_action,
        responsible: line.responsible,
        target_date: line.target_date,
        actions_taken: line.actions_taken,
        line_status: line.line_status,
        s_after: line.s_after,
        o_after: line.o_after,
        d_after: line.d_after,
        is_active: line.is_active,
        cp_integration_note: line.cp_integration_note,
      };
      const { error } = await supabase.from('fmea_lines').insert(copy).select().single();
      if (error) {
        toast({ variant: 'destructive', title: 'Kopyalanamadı', description: error.message });
        return;
      }
      await loadDetail(selectedId);
      toast({ title: 'Satır kopyalandı' });
    },
    [selectedId, canEdit, lines, toast, loadDetail]
  );

  const handleToggleActive = useCallback(
    async (line) => {
      if (!canEdit) return;
      const next = { ...line, is_active: !line.is_active };
      handleUpdateLine(line.id, next);
      const { error } = await supabase.from('fmea_lines').update({ is_active: next.is_active }).eq('id', line.id);
      if (error) toast({ variant: 'destructive', title: 'Güncellenemedi', description: error.message });
    },
    [canEdit, handleUpdateLine, toast]
  );

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (listStatusFilter !== 'all') {
      list = list.filter((p) => p.status === listStatusFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        (p.fmea_name || '').toLowerCase().includes(q) ||
        (p.fmea_number || '').toLowerCase().includes(q) ||
        (p.part_number || '').toLowerCase().includes(q) ||
        (p.part_name || '').toLowerCase().includes(q)
    );
  }, [projects, search, listStatusFilter]);

  const filteredLines = useMemo(() => {
    const q = sheetLineFilter.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) => {
      const blob = [
        l.process_step,
        l.function_text,
        l.failure_mode,
        l.effect,
        l.cause,
        l.current_prevention,
        l.current_detection,
        l.recommended_action,
        l.responsible,
        l.cp_integration_note,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [lines, sheetLineFilter]);

  const cpReviewIds = useMemo(() => {
    const s = new Set();
    lines.forEach((l) => {
      if (lineNeedsCpReview(l, fmeaSettings)) s.add(l.id);
    });
    return s;
  }, [lines, fmeaSettings]);

  const plansForFollowupDropdown = useMemo(() => {
    const pn = normalizePartCode(project?.part_number);
    const raw = followupKind === 'incoming' ? incomingPlansForCp : processPlansForCp;
    if (!pn) return raw;
    const matched = raw.filter((p) => normalizePartCode(p.part_code) === pn);
    return matched.length ? matched : raw;
  }, [followupKind, incomingPlansForCp, processPlansForCp, project?.part_number]);

  const cpSummary = useMemo(() => {
    const active = lines.filter((l) => l.is_active);
    const needLines = active.filter((l) => lineNeedsCpReview(l, fmeaSettings));
    const openFu = followups.filter((f) => f.status === 'open').length;
    return { needCount: needLines.length, openFollowups: openFu, needLines };
  }, [lines, fmeaSettings, followups]);

  const handlePdfProjectList = useCallback(() => {
    openPrintableReport(
      { items: filteredProjects, title: 'FMEA Proje Listesi' },
      'fmea_project_list',
      true
    );
  }, [filteredProjects]);

  const handlePdfFmeaSheet = useCallback(() => {
    if (!project?.id) return;
    openPrintableReport({ ...project, fmea_lines: lines }, 'fmea', true);
  }, [project, lines]);

  const summary = useMemo(() => {
    const active = lines.filter((l) => l.is_active);
    const rpns = active.map((l) => l.rpn).filter((n) => n != null);
    const maxRpn = rpns.length ? Math.max(...rpns) : 0;
    const apCount = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const l of active) {
      if (l.ap_level && apCount[l.ap_level] != null) apCount[l.ap_level] += 1;
    }
    return { total: lines.length, active: active.length, maxRpn, apCount };
  }, [lines]);

  const openEditProject = () => {
    if (!project) return;
    setEditingProject({ ...project });
    setProjectDialogOpen(true);
  };

  const openFiveTopics = () => {
    if (!project) return;
    setEditingProject({
      ...project,
      five_topics: normalizeFiveTopicsObject(project.five_topics),
    });
    setFiveDialogOpen(true);
  };

  const saveFiveTopics = async () => {
    if (!editingProject?.id || !canEdit) return;
    const { error } = await supabase
      .from('fmea_projects')
      .update({ five_topics: normalizeFiveTopicsObject(editingProject.five_topics) })
      .eq('id', editingProject.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Kaydedilemedi', description: error.message });
      return;
    }
    toast({ title: '5T bilgileri kaydedildi' });
    setFiveDialogOpen(false);
    if (selectedId) loadDetail(selectedId);
  };

  const openFmeaSettings = () => {
    const m = mergeFmeaSettings(fmeaSettings);
    setSettingsDraft({
      rpn_action_threshold: String(m.rpn_action_threshold),
      rpn_after_action_threshold: m.rpn_after_action_threshold != null ? String(m.rpn_after_action_threshold) : '',
      alert_on_ap_high: m.alert_on_ap_high,
      alert_on_ap_medium: m.alert_on_ap_medium,
    });
    setSettingsDialogOpen(true);
  };

  const saveFmeaSettings = async () => {
    if (!settingsDraft) return;
    const { error } = await supabase.from('fmea_app_settings').upsert({
      id: 1,
      rpn_action_threshold: Math.min(1000, Math.max(1, parseInt(settingsDraft.rpn_action_threshold, 10) || 100)),
      rpn_after_action_threshold:
        settingsDraft.rpn_after_action_threshold === '' || settingsDraft.rpn_after_action_threshold == null
          ? null
          : Math.min(1000, Math.max(1, parseInt(settingsDraft.rpn_after_action_threshold, 10))),
      alert_on_ap_high: !!settingsDraft.alert_on_ap_high,
      alert_on_ap_medium: !!settingsDraft.alert_on_ap_medium,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Ayarlar kaydedilemedi', description: error.message });
      return;
    }
    await loadFmeaSettings();
    setSettingsDialogOpen(false);
    toast({ title: 'FMEA ayarları güncellendi' });
  };

  const submitFollowup = async () => {
    if (!selectedId || !followupPlanId || !user) return;
    setSavingFollowup(true);
    const line = followupLineId ? lines.find((l) => l.id === followupLineId) : null;
    const trig = line ? inferTriggerTypeForFollowup(line, fmeaSettings) : 'manual';
    const list = followupKind === 'incoming' ? incomingPlansForCp : processPlansForCp;
    const plan = list.find((p) => p.id === followupPlanId);
    const title = plan
      ? `${plan.plan_name || plan.part_code || 'Plan'} (${followupKind === 'incoming' ? 'Girdi KP' : 'Proses KP'})`
      : 'Kontrol planı';
    const { error } = await supabase.from('fmea_control_plan_followups').insert({
      project_id: selectedId,
      line_id: followupLineId || null,
      trigger_type: trig,
      control_plan_kind: followupKind,
      control_plan_id: followupPlanId,
      title,
      note: followupNote.trim() || null,
      status: 'open',
    });
    setSavingFollowup(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Kayıt eklenemedi', description: error.message });
      return;
    }
    toast({ title: 'Takip kaydı oluşturuldu; Girdi Kalite veya Proses Kontrol modülünde planı güncelleyin.' });
    setAddFollowupOpen(false);
    setFollowupPlanId('');
    setFollowupLineId('');
    setFollowupNote('');
    const { data: fu } = await supabase
      .from('fmea_control_plan_followups')
      .select('*')
      .eq('project_id', selectedId)
      .order('created_at', { ascending: false });
    setFollowups(fu || []);
  };

  const resolveFollowup = async () => {
    if (!resolveTargetId || !user) return;
    const { error } = await supabase
      .from('fmea_control_plan_followups')
      .update({
        status: 'done',
        resolution_note: resolveNote.trim() || null,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', resolveTargetId);
    if (error) {
      toast({ variant: 'destructive', title: 'Güncellenemedi', description: error.message });
      return;
    }
    toast({ title: 'Kontrol planı güncellemesi tamamlandı olarak işlendi' });
    setResolveOpen(false);
    setResolveTargetId(null);
    setResolveNote('');
    const { data: fu } = await supabase
      .from('fmea_control_plan_followups')
      .select('*')
      .eq('project_id', selectedId)
      .order('created_at', { ascending: false });
    setFollowups(fu || []);
  };

  return (
    <>
      {!selectedId ? (
        <>
          <Helmet>
            <title>FMEA — Kademe QMS</title>
          </Helmet>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">FMEA</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Hata türü ve etkiler analizi (PFMEA / DFMEA). Projeleri seçin veya yeni analiz oluşturun.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={openFmeaSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  FMEA ayarları
                </Button>
                {canEdit && (
                  <Button onClick={createProject} className="bg-[#2980b9] hover:bg-[#2471a3]">
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni FMEA projesi
                  </Button>
                )}
              </div>
            </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex h-10 w-full min-w-0 max-w-full sm:max-w-md items-center gap-2.5 rounded-md border border-input bg-background px-3 shadow-sm ring-offset-background transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <Search className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Proje, FMEA no, parça veya ad ara..."
                aria-label="Ara"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Label htmlFor="fmea-list-status" className="text-sm text-muted-foreground whitespace-nowrap shrink-0">
                Durum
              </Label>
              <Select value={listStatusFilter} onValueChange={setListStatusFilter}>
                <SelectTrigger id="fmea-list-status" className="h-10 w-full sm:w-[200px]">
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {STATUS_OPTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" className="h-10 w-full sm:w-auto shrink-0" onClick={handlePdfProjectList}>
              <FileDown className="mr-2 h-4 w-4" />
              PDF liste
            </Button>
          </div>

          <Card className="overflow-hidden border-border shadow-sm">
            {loadingList ? (
              <div className="p-8 text-center text-muted-foreground">Yükleniyor…</div>
            ) : projects.length === 0 ? (
              <div className="p-10 text-center border-dashed">
                <p className="font-medium text-foreground">Henüz FMEA projesi yok</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Yeni analiz başlatmak için yukarıdaki &quot;Yeni FMEA projesi&quot; düğmesini kullanın.
                </p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Sonuç bulunamadı. Arama veya durum filtresini değiştirin.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>FMEA no</TableHead>
                      <TableHead className="min-w-[180px]">Ad</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead>Parça no</TableHead>
                      <TableHead className="min-w-[120px]">Parça adı</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Güncelleme</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((p, i) => (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-[#2980b9]/5"
                        onClick={() => setSelectedId(p.id)}
                      >
                        <TableCell className="text-center text-muted-foreground font-mono text-sm">{i + 1}</TableCell>
                        <TableCell className="font-medium">{p.fmea_number}</TableCell>
                        <TableCell>{p.fmea_name}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.fmea_type}</TableCell>
                        <TableCell>{p.part_number || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.part_name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === 'Active' ? 'default' : 'secondary'}>{statusLabel(p.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          {p.updated_at
                            ? format(new Date(p.updated_at), 'd MMM yyyy HH:mm', { locale: tr })
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
          </motion.div>
        </>
      ) : (
        <>
          <Helmet>
            <title>{project?.fmea_name ? `${project.fmea_name} — FMEA` : 'FMEA'} — Kademe QMS</title>
          </Helmet>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Projeler
            </Button>
            <h2 className="text-xl font-semibold truncate max-w-[min(100%,28rem)]">{project?.fmea_name || 'FMEA'}</h2>
            {project && (
              <Badge variant="outline">
                {ANALYSIS_TYPES.find((a) => a.value === project.fmea_type)?.label || project.fmea_type}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={openFmeaSettings}>
              <Settings className="mr-2 h-4 w-4" />
              Ayarlar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddFollowupOpen(true)}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              KP takibi
            </Button>
            {canEdit && (
              <>
                <Button size="sm" variant="outline" onClick={openEditProject}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Proje bilgisi
                </Button>
                <Button size="sm" variant="outline" onClick={openFiveTopics}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  5T
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleAddLine(null)} disabled={loadingDetail}>
                  <Plus className="mr-2 h-4 w-4" />
                  Satır ekle
                </Button>
                <Button
                  size="sm"
                  className="bg-[#2980b9] hover:bg-[#2471a3]"
                  onClick={saveLines}
                  disabled={saving || loadingDetail}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </Button>
              </>
            )}
            <Button size="sm" variant="default" className="bg-[#1e3a5f] hover:bg-[#152a45]" onClick={handlePdfFmeaSheet}>
              <FileDown className="mr-2 h-4 w-4" />
              PDF rapor
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  `fmea-${project?.fmea_name?.replace(/\s+/g, '_') || 'export'}.csv`,
                  lines.filter((l) => l.is_active)
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            {canEdit && project && (
              <Button size="sm" variant="destructive" onClick={() => setDeleteId(project.id)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Sil
              </Button>
            )}
          </div>
        </div>

        {loadingDetail ? (
          <p className="text-muted-foreground">Yükleniyor…</p>
        ) : (
          <Tabs value={workTab} onValueChange={setWorkTab} className="w-full">
            <TabsList className="bg-muted/80">
              <TabsTrigger value="sheet" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Çalışma sayfası
              </TabsTrigger>
              <TabsTrigger value="summary" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Özet
              </TabsTrigger>
            </TabsList>
            <TabsContent value="sheet" className="mt-4 space-y-3">
              {!canEdit && (
                <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                  Salt okunur: Bu modülde düzenleme yetkiniz yok.
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div className="flex h-10 w-full min-w-0 max-w-full sm:max-w-md items-center gap-2.5 rounded-md border border-input bg-background px-3 shadow-sm ring-offset-background transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <Search className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <input
                    type="text"
                    value={sheetLineFilter}
                    onChange={(e) => setSheetLineFilter(e.target.value)}
                    placeholder="Satırlarda ara (metin filtre)..."
                    aria-label="Çalışma sayfasında ara"
                    className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
                {sheetLineFilter.trim() && (
                  <p className="text-xs text-muted-foreground">
                    {filteredLines.length} / {lines.length} satır gösteriliyor
                  </p>
                )}
              </div>
              <FmeaSheetTable
                lines={filteredLines}
                personnel={personnel || []}
                canEdit={canEdit}
                onUpdateLine={handleUpdateLine}
                onAddLine={handleAddLine}
                onDuplicateLine={handleDuplicateLine}
                onToggleActive={handleToggleActive}
                cpReviewIds={cpReviewIds}
              />
            </TabsContent>
            <TabsContent value="summary" className="mt-4 space-y-4">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
                <div className="flex flex-wrap items-start gap-2">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
                  <div>
                    <p className="font-medium">Kontrol planları ile entegrasyon</p>
                    <p className="text-muted-foreground mt-1">
                      Eşik: RPN ≥ {mergeFmeaSettings(fmeaSettings).rpn_action_threshold}
                      {mergeFmeaSettings(fmeaSettings).rpn_after_action_threshold != null
                        ? ` · RPN′ ≥ ${mergeFmeaSettings(fmeaSettings).rpn_after_action_threshold}`
                        : ''}
                      . Bu özet ve çalışma sayfasındaki vurgulu satırlar, girdi veya proses kontrol planında güncelleme
                      yapmanız gerekebileceğini gösterir. Takip kaydı oluşturup planı modülde güncelledikten sonra
                      &quot;Tamamlandı&quot; ile işleyin.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Toplam satır</CardDescription>
                    <CardTitle className="text-3xl">{summary.total}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Aktif satır</CardDescription>
                    <CardTitle className="text-3xl">{summary.active}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>En yüksek RPN</CardDescription>
                    <CardTitle className="text-3xl">{summary.maxRpn || '—'}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Öncelik dağılımı</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Badge className={cn(apBadgeClass('HIGH'))}>Yüksek: {summary.apCount.HIGH}</Badge>
                    <Badge className={cn(apBadgeClass('MEDIUM'))}>Orta: {summary.apCount.MEDIUM}</Badge>
                    <Badge className={cn(apBadgeClass('LOW'))}>Düşük: {summary.apCount.LOW}</Badge>
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Kontrol planı gözden geçirmesi</CardTitle>
                    <CardDescription>
                      Eşik / öncelik uyarısı olan satır: {cpSummary.needCount} · Açık takip: {cpSummary.openFollowups}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {cpSummary.needLines.length === 0 ? (
                      <p className="text-muted-foreground">Şu an uyarı koşuluna giren aktif satır yok.</p>
                    ) : (
                      <ul className="space-y-2 max-h-[220px] overflow-y-auto">
                        {cpSummary.needLines.slice(0, 20).map((l) => (
                          <li key={l.id} className="border-b border-border/60 pb-2">
                            <span className="font-medium">{l.process_step || '—'}</span>
                            {' · '}
                            {l.failure_mode || 'Hata'}
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {getCpReviewReasons(l, fmeaSettings).map((r) => r.label).join(' · ')}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="text-base">Kontrol planı takip kayıtları</CardTitle>
                      <CardDescription>Girdi ve proses KP güncellemeleri</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setAddFollowupOpen(true)}>
                      Yeni kayıt
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {followups.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Henüz takip kaydı yok.</p>
                    ) : (
                      <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tarih</TableHead>
                              <TableHead>Plan</TableHead>
                              <TableHead>Tür</TableHead>
                              <TableHead>Durum</TableHead>
                              <TableHead className="text-right">İşlem</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {followups.map((f) => (
                              <TableRow key={f.id}>
                                <TableCell className="whitespace-nowrap text-xs">
                                  {f.created_at
                                    ? format(new Date(f.created_at), 'd MMM yyyy HH:mm', { locale: tr })
                                    : '—'}
                                </TableCell>
                                <TableCell className="max-w-[200px] text-sm">{f.title || '—'}</TableCell>
                                <TableCell className="text-xs">
                                  {f.control_plan_kind === 'incoming' ? 'Girdi KP' : 'Proses KP'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={f.status === 'open' ? 'secondary' : 'outline'}>
                                    {f.status === 'open' ? 'Açık' : f.status === 'done' ? 'Tamam' : 'İptal'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {f.status === 'open' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8"
                                      onClick={() => {
                                        setResolveTargetId(f.id);
                                        setResolveNote('');
                                        setResolveOpen(true);
                                      }}
                                    >
                                      Tamamlandı
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">RPN sıralaması (ilk 15)</CardTitle>
                  <CardDescription>Aktif satırlar, RPN azalan</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[280px] pr-4">
                    <ul className="space-y-2 text-sm">
                      {[...lines]
                        .filter((l) => l.is_active && l.rpn != null)
                        .sort((a, b) => (b.rpn || 0) - (a.rpn || 0))
                        .slice(0, 15)
                        .map((l) => (
                          <li key={l.id} className="flex justify-between gap-4 border-b border-border/60 pb-2">
                            <span className="truncate">
                              {l.process_step || '—'} → {l.failure_mode || 'Hata'}
                            </span>
                            <span className="font-mono shrink-0">RPN {l.rpn}</span>
                          </li>
                        ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </motion.div>

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proje bilgisi</DialogTitle>
            <DialogDescription>FMEA üst verileri ve standart seçimi.</DialogDescription>
          </DialogHeader>
          {editingProject && (
            <div className="space-y-3">
              <div>
                <Label>FMEA adı</Label>
                <Input
                  value={editingProject.fmea_name || ''}
                  onChange={(e) => setEditingProject((p) => ({ ...p, fmea_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>FMEA numarası</Label>
                <Input
                  value={editingProject.fmea_number || ''}
                  onChange={(e) => setEditingProject((p) => ({ ...p, fmea_number: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Parça no</Label>
                  <Input
                    value={editingProject.part_number || ''}
                    onChange={(e) => setEditingProject((p) => ({ ...p, part_number: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Parça adı</Label>
                  <Input
                    value={editingProject.part_name || ''}
                    onChange={(e) => setEditingProject((p) => ({ ...p, part_name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Revizyon</Label>
                  <Input
                    value={editingProject.revision_number || ''}
                    onChange={(e) => setEditingProject((p) => ({ ...p, revision_number: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Revizyon tarihi</Label>
                  <Input
                    type="date"
                    value={editingProject.revision_date || ''}
                    onChange={(e) => setEditingProject((p) => ({ ...p, revision_date: e.target.value || null }))}
                  />
                </div>
              </div>
              <div>
                <Label>Firma</Label>
                <Input
                  value={editingProject.company_name || ''}
                  onChange={(e) => setEditingProject((p) => ({ ...p, company_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Müşteriler (virgülle)</Label>
                <Input
                  value={(editingProject.customer_names || []).join(', ')}
                  onChange={(e) =>
                    setEditingProject((p) => ({
                      ...p,
                      customer_names: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Ekip üyeleri</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between font-normal h-auto min-h-10 py-2 px-3">
                      <span className="flex items-center gap-2 text-left truncate">
                        <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {(editingProject.team_member_names || []).length > 0
                          ? `${(editingProject.team_member_names || []).length} kişi seçildi`
                          : 'Personel listesinden seçin'}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="z-[60] w-[min(100vw-2rem,380px)] p-0 flex flex-col max-h-[min(70vh,400px)] overflow-hidden"
                    align="start"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <div className="p-2 border-b border-border shrink-0">
                      <Input
                        placeholder="Üyede ara (isim)…"
                        value={teamMemberSearch}
                        onChange={(e) => setTeamMemberSearch(e.target.value)}
                        className="h-9"
                        autoComplete="off"
                      />
                    </div>
                    <div
                      className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 [-webkit-overflow-scrolling:touch] touch-pan-y"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {(personnel || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground p-2">Personel listesi yüklenemedi.</p>
                      ) : filteredTeamPersonnel.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-2">Eşleşen personel yok.</p>
                      ) : (
                        filteredTeamPersonnel.map((p) => (
                          <label
                            key={p.id}
                            htmlFor={`fmea-team-${p.id}`}
                            className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted cursor-pointer"
                          >
                            <Checkbox
                              id={`fmea-team-${p.id}`}
                              checked={(editingProject.team_member_names || []).includes(p.full_name)}
                              onCheckedChange={(c) => {
                                const cur = editingProject.team_member_names || [];
                                const next = c
                                  ? [...cur, p.full_name].filter((x, i, a) => a.indexOf(x) === i)
                                  : cur.filter((n) => n !== p.full_name);
                                setEditingProject((ep) => ({ ...ep, team_member_names: next }));
                              }}
                            />
                            <span className="text-sm">{p.full_name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {(editingProject.team_member_names || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(editingProject.team_member_names || []).map((name) => (
                      <Badge key={name} variant="secondary" className="font-normal">
                        {name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Analiz tipi</Label>
                  <Select
                    value={editingProject.fmea_type || 'PFMEA'}
                    onValueChange={(v) => setEditingProject((p) => ({ ...p, fmea_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANALYSIS_TYPES.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Standart</Label>
                  <Select
                    value={editingProject.standard || 'AIAG_VDA'}
                    onValueChange={(v) => setEditingProject((p) => ({ ...p, standard: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARDS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Durum</Label>
                <Select
                  value={editingProject.status || 'Draft'}
                  onValueChange={(v) => setEditingProject((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notlar</Label>
                <Textarea
                  value={editingProject.notes || ''}
                  onChange={(e) => setEditingProject((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>
              Kapat
            </Button>
            {canEdit && (
              <Button className="bg-[#2980b9] hover:bg-[#2471a3]" onClick={saveProjectMeta}>
                Kaydet
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fiveDialogOpen} onOpenChange={setFiveDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>5T — Analiz öncesi yapılandırma</DialogTitle>
            <DialogDescription>
              Her başlık için önceden tanımlı seçenek ve isteğe bağlı detay metni kaydedilir.
            </DialogDescription>
          </DialogHeader>
          {editingProject && (
            <div className="space-y-4">
              {(() => {
                const ft = normalizeFiveTopicsObject(editingProject.five_topics || {});
                return FIVE_T_KEYS.map((key) => {
                  const field = ft[key];
                  const opts = FIVE_T_OPTIONS[key] || [];
                  return (
                    <div key={key} className="space-y-1.5">
                      <Label>{FIVE_T_LABELS[key]}</Label>
                      <Select
                        value={field.preset || PRESET_EMPTY}
                        onValueChange={(v) =>
                          setEditingProject((p) => {
                            const prev = normalizeFiveTopicsObject(p.five_topics || {});
                            const cur = prev[key];
                            return {
                              ...p,
                              five_topics: {
                                ...prev,
                                [key]: { ...cur, preset: v === PRESET_EMPTY ? '' : v },
                              },
                            };
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seçiniz…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={PRESET_EMPTY}>Seçiniz…</SelectItem>
                          {opts
                            .filter((o) => o.value !== '')
                            .map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        className="min-h-[72px]"
                        placeholder="Detay / ek notlar (isteğe bağlı)"
                        value={field.detail}
                        onChange={(e) =>
                          setEditingProject((p) => {
                            const prev = normalizeFiveTopicsObject(p.five_topics || {});
                            const cur = prev[key];
                            return {
                              ...p,
                              five_topics: {
                                ...prev,
                                [key]: { ...cur, detail: e.target.value },
                              },
                            };
                          })
                        }
                      />
                    </div>
                  );
                });
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFiveDialogOpen(false)}>
              Kapat
            </Button>
            {canEdit && (
              <Button className="bg-[#2980b9] hover:bg-[#2471a3]" onClick={saveFiveTopics}>
                Kaydet
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Projeyi silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz. Projeye ait tüm FMEA satırları silinir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={deleteProject} className="bg-destructive text-destructive-foreground">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>FMEA ayarları</DialogTitle>
            <DialogDescription>
              Aksiyon ve kontrol planı uyarıları için eşik değerler (tüm FMEA projeleri için geçerlidir).
            </DialogDescription>
          </DialogHeader>
          {settingsDraft && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="fmea-thr-rpn">RPN eşiği (aksiyon / KP gözden geçirme)</Label>
                <Input
                  id="fmea-thr-rpn"
                  type="number"
                  min={1}
                  max={1000}
                  className="mt-1"
                  value={settingsDraft.rpn_action_threshold}
                  onChange={(e) =>
                    setSettingsDraft((d) => (d ? { ...d, rpn_action_threshold: e.target.value } : d))
                  }
                />
              </div>
              <div>
                <Label htmlFor="fmea-thr-rpna">RPN′ eşiği (boş bırakılırsa RPN ile aynı)</Label>
                <Input
                  id="fmea-thr-rpna"
                  type="number"
                  min={1}
                  max={1000}
                  placeholder="Örn. 100"
                  className="mt-1"
                  value={settingsDraft.rpn_after_action_threshold}
                  onChange={(e) =>
                    setSettingsDraft((d) => (d ? { ...d, rpn_after_action_threshold: e.target.value } : d))
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="fmea-ap-h"
                  checked={settingsDraft.alert_on_ap_high}
                  onCheckedChange={(c) =>
                    setSettingsDraft((d) => (d ? { ...d, alert_on_ap_high: c === true } : d))
                  }
                />
                <Label htmlFor="fmea-ap-h" className="font-normal cursor-pointer">
                  Yüksek öncelik (AP) için uyar
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="fmea-ap-m"
                  checked={settingsDraft.alert_on_ap_medium}
                  onCheckedChange={(c) =>
                    setSettingsDraft((d) => (d ? { ...d, alert_on_ap_medium: c === true } : d))
                  }
                />
                <Label htmlFor="fmea-ap-m" className="font-normal cursor-pointer">
                  Orta öncelik (AP) için uyar
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
              Kapat
            </Button>
            <Button className="bg-[#2980b9] hover:bg-[#2471a3]" onClick={saveFmeaSettings}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cpSaveAlertOpen} onOpenChange={setCpSaveAlertOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Kontrol planı gözden geçirmesi</AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <span className="block text-foreground">
                Kayıtlı satırlarda RPN / öncelik eşikleri veya KP notu nedeniyle{' '}
                <strong>{cpSaveAlertLines.length}</strong> satır için girdi veya proses kontrol planında güncelleme
                yapmanız gerekebilir.
              </span>
              <ul className="list-disc pl-5 text-sm text-muted-foreground max-h-[160px] overflow-y-auto">
                {cpSaveAlertLines.slice(0, 8).map((l) => (
                  <li key={l.id}>
                    {l.process_step || '—'} — {l.failure_mode || 'Hata'} (RPN {l.rpn ?? '—'})
                  </li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setCpSaveAlertOpen(false)}>Tamam</AlertDialogCancel>
            <Button
              variant="secondary"
              onClick={() => {
                setCpSaveAlertOpen(false);
                setWorkTab('summary');
              }}
            >
              Özet sekmesine git
            </Button>
            <AlertDialogAction
              className="bg-[#2980b9] hover:bg-[#2471a3]"
              onClick={() => {
                setCpSaveAlertOpen(false);
                setAddFollowupOpen(true);
              }}
            >
              Takip kaydı oluştur
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addFollowupOpen} onOpenChange={setAddFollowupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kontrol planı takip kaydı</DialogTitle>
            <DialogDescription>
              Girdi kalite veya proses kontrol modülündeki ilgili kontrol planını güncelledikten sonra burada kayıt
              tutun. Parça no: {project?.part_number || '—'} (eşleşen planlar öne alınır).
            </DialogDescription>
          </DialogHeader>
          {!selectedId ? (
            <p className="text-sm text-destructive">Önce bir FMEA projesi seçin.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Plan türü</Label>
                <Select value={followupKind} onValueChange={setFollowupKind}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incoming">Girdi kontrol planı</SelectItem>
                    <SelectItem value="process">Proses kontrol planı</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>İlişkili FMEA satırı (isteğe bağlı)</Label>
                <Select value={followupLineId || '__none__'} onValueChange={(v) => setFollowupLineId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Satır seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Satır yok —</SelectItem>
                    {lines.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {(l.process_step || '').slice(0, 40) || 'Satır'} — RPN {l.rpn ?? '—'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kontrol planı</Label>
                <Select value={followupPlanId} onValueChange={setFollowupPlanId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Plan seçin" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {plansForFollowupDropdown.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">Plan bulunamadı.</div>
                    ) : (
                      plansForFollowupDropdown.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.part_code || '—'} · {p.plan_name || p.part_name || 'Plan'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Not</Label>
                <Textarea
                  className="mt-1 min-h-[72px]"
                  placeholder="Örn. ölçü X için sıklık artırıldı…"
                  value={followupNote}
                  onChange={(e) => setFollowupNote(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFollowupOpen(false)}>
              İptal
            </Button>
            <Button
              className="bg-[#2980b9] hover:bg-[#2471a3]"
              disabled={!selectedId || !followupPlanId || savingFollowup}
              onClick={submitFollowup}
            >
              {savingFollowup ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kontrol planı güncellemesi tamamlandı</DialogTitle>
            <DialogDescription>
              İlgili kontrol planında yaptığınız değişikliği kısaca özetleyin (revizyon, madde ekleme vb.).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-[100px]"
            placeholder="Örn. Girdi KP rev. 3 — tolerans satırı güncellendi."
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>
              İptal
            </Button>
            <Button className="bg-[#2980b9] hover:bg-[#2471a3]" onClick={resolveFollowup}>
              Tamamlandı olarak işle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
