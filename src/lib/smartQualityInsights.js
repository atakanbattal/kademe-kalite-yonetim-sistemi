import {
  Calendar,
  TrendingUp,
  ClipboardList,
  GraduationCap,
  ShieldAlert,
  CheckSquare,
  Beaker,
  Package,
  MessageSquare,
  Sparkles,
  FileWarning,
  Truck,
  BarChart2,
  ScrollText,
  Users,
  ClipboardCheck,
  Gauge,
  Car,
  Factory,
  BookOpen,
  AlertOctagon,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';

const CLOSED = new Set(['Kapatıldı', 'Kapalı', 'Kapatildi', 'Reddedildi', 'İptal', 'Tamamlandı']);

function isOpenNcLike(status) {
  if (!status) return true;
  return !CLOSED.has(status);
}

function pushInsight(list, item) {
  if (!list.some((x) => x.id === item.id)) list.push(item);
}

/**
 * DataContext’ten gelen tüm ilgili koleksiyonlarla kalite içgörüleri üretir.
 */
export function buildSmartQualityInsights(ctx) {
  const {
    loading,
    audits,
    nonConformities,
    deviations,
    trainings,
    tasks,
    quarantineRecords,
    incomingInspections,
    supplierNonConformities,
    customerComplaints,
    kaizenEntries,
    kpis,
    auditFindings,
    producedVehicles,
    stockRiskControls,
    inkrReports,
    incomingControlPlans,
    processControlPlans,
    suppliers,
    nonconformityRecords,
    qualityCosts,
    documents,
    equipments,
    auditLogs,
  } = ctx;

  if (loading) return [];

  const list = [];
  const today = new Date();
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

  const ncs = nonConformities || [];

  // ——— İç tetkik (audits) ———
  const completedAudits = (audits || []).filter((a) => a.status === 'Tamamlandı' && a.audit_date);
  const lastAudit = completedAudits.length
    ? [...completedAudits].sort((a, b) => new Date(b.audit_date) - new Date(a.audit_date))[0]
    : null;
  const daysSinceAudit = lastAudit ? differenceInDays(today, new Date(lastAudit.audit_date)) : null;

  if (!lastAudit) {
    pushInsight(list, {
      id: 'audit-none',
      tone: 'amber',
      icon: Calendar,
      title: 'İç tetkik kaydı',
      body: 'Tamamlanmış bir iç tetkik bulunmuyor. ISO 9001 ve sürekli iyileştirme için planlı iç tetkikler kritik öneme sahiptir.',
      actionLabel: 'İç tetkik modülü',
      module: 'internal-audit',
    });
  } else if (daysSinceAudit >= 180) {
    pushInsight(list, {
      id: 'audit-stale-180',
      tone: 'red',
      icon: Calendar,
      title: `${daysSinceAudit} gündür tamamlanmış iç tetkik yok`,
      body: `Son tamamlanan tetkik: ${format(new Date(lastAudit.audit_date), 'd MMMM yyyy', { locale: tr })}. Yönetim gözden geçirmesi öncesi yeni tetkik planlamanız önerilir.`,
      actionLabel: 'Tetkikler',
      module: 'internal-audit',
    });
  } else if (daysSinceAudit >= 90) {
    pushInsight(list, {
      id: 'audit-stale-90',
      tone: 'amber',
      icon: Calendar,
      title: `Son iç tetkikten ${daysSinceAudit} gün geçti`,
      body: 'Periyodik iç tetkik takviminizi gözden geçirmek riskleri erken görmenizi sağlar.',
      actionLabel: 'İç tetkik',
      module: 'internal-audit',
    });
  }

  const activeAuditPlans = (audits || []).filter(
    (a) => a.status && !['Tamamlandı', 'İptal Edildi', 'İptal'].includes(a.status)
  ).length;
  if (activeAuditPlans >= 3) {
    pushInsight(list, {
      id: 'audit-many-active',
      tone: 'slate',
      icon: ClipboardCheck,
      title: 'Devam eden tetkikler',
      body: `${activeAuditPlans} adet henüz tamamlanmamış iç tetkik kaydı var. Bulgu kapanışlarını takip edin.`,
      actionLabel: 'İç tetkik',
      module: 'internal-audit',
    });
  }

  // ——— DF / 8D (non_conformities) ———
  const openedDfThisMonth = ncs.filter((n) => {
    if (n.type !== 'DF') return false;
    const d = new Date(n.opening_date || n.created_at);
    return d >= thisMonthStart;
  }).length;
  const openedDfLastMonth = ncs.filter((n) => {
    if (n.type !== 'DF') return false;
    const d = new Date(n.opening_date || n.created_at);
    return d >= lastMonthStart && d <= lastMonthEnd;
  }).length;

  if (openedDfLastMonth > 0 && openedDfThisMonth > openedDfLastMonth) {
    const pct = Math.round(((openedDfThisMonth - openedDfLastMonth) / openedDfLastMonth) * 100);
    if (pct >= 15) {
      pushInsight(list, {
        id: 'df-rate-up',
        tone: 'amber',
        icon: TrendingUp,
        title: 'DF açılışları geçen aya göre yükseliyor',
        body: `Bu ay ${openedDfThisMonth}, geçen ay ${openedDfLastMonth} DF açıldı (%${pct} artış). Kök neden ve tekrarlayan problemleri önceliklendirin.`,
        actionLabel: 'DF / 8D',
        module: 'df-8d',
      });
    }
  } else if (openedDfLastMonth === 0 && openedDfThisMonth >= 3) {
    pushInsight(list, {
      id: 'df-spike',
      tone: 'amber',
      icon: TrendingUp,
      title: 'Bu ay DF yoğunluğu dikkat çekiyor',
      body: `Geçen ay açılan DF yokken bu ay ${openedDfThisMonth} DF oluştu. Süreç stabilitesini gözden geçirin.`,
      actionLabel: 'DF / 8D',
      module: 'df-8d',
    });
  }

  const openDf = ncs.filter(
    (n) => n.type === 'DF' && n.status !== 'Kapatıldı' && n.status !== 'Reddedildi'
  ).length;
  if (openDf >= 8) {
    pushInsight(list, {
      id: 'df-backlog',
      tone: 'slate',
      icon: ClipboardList,
      title: 'Açık DF birikimi',
      body: `${openDf} açık DF var. Önceliklendirme ve kaynak planlaması ile kapanış hızını artırın.`,
      actionLabel: 'DF / 8D',
      module: 'df-8d',
    });
  }

  const open8d = ncs.filter(
    (n) => n.type === '8D' && n.status !== 'Kapatıldı' && n.status !== 'Reddedildi'
  ).length;
  if (open8d >= 5) {
    pushInsight(list, {
      id: '8d-backlog',
      tone: 'amber',
      icon: AlertOctagon,
      title: 'Açık 8D kayıtları',
      body: `${open8d} adet açık 8D süreci devam ediyor. Karmaşık problemlerde ekip ve milestone takvimini netleştirin.`,
      actionLabel: '8D kayıtları',
      module: 'df-8d',
    });
  }

  // ——— Uygunsuzluk kayıtları (nonconformity_records) ———
  const openRecords = (nonconformityRecords || []).filter((r) => isOpenNcLike(r.status));
  if (openRecords.length >= 10) {
    pushInsight(list, {
      id: 'nc-records-open',
      tone: 'amber',
      icon: FileWarning,
      title: 'Açık uygunsuzluk kayıtları',
      body: `${openRecords.length} adet kapatılmamış uygunsuzluk kaydı listeleniyor. DF/8D ile hizalayıp kapanışları hızlandırın.`,
      actionLabel: 'Uygunsuzluk yönetimi',
      module: 'nonconformity',
    });
  }

  const criticalOpen = openRecords.filter((r) => r.severity === 'Kritik' || r.severity === 'Yüksek').length;
  if (criticalOpen >= 3) {
    pushInsight(list, {
      id: 'nc-records-severity',
      tone: 'red',
      icon: ShieldAlert,
      title: 'Kritik / yüksek öncelikli açık kayıtlar',
      body: `${criticalOpen} adet kritik veya yüksek ciddiyette açık uygunsuzluk kaydı var. Önce bunları ele alın.`,
      actionLabel: 'Uygunsuzluklar',
      module: 'nonconformity',
    });
  }

  // ——— Sapma ———
  const pendingDeviations = (deviations || []).filter((d) => d.status === 'Onay Bekliyor').length;
  if (pendingDeviations > 0) {
    pushInsight(list, {
      id: 'deviation-pending',
      tone: 'slate',
      icon: ShieldAlert,
      title: 'Bekleyen sapma onayları',
      body: `${pendingDeviations} sapma onay bekliyor. Gecikmeler üretim ve uyumlulukta risk oluşturur.`,
      actionLabel: 'Sapma yönetimi',
      module: 'deviation',
    });
  }

  // ——— Eğitim ———
  const trains = trainings || [];
  const doneTrain = trains.filter((t) => t.status === 'Tamamlandı').length;
  const rateTrain = trains.length > 0 ? Math.round((doneTrain / trains.length) * 100) : 100;
  if (trains.length >= 5 && rateTrain < 40) {
    pushInsight(list, {
      id: 'training-low',
      tone: 'slate',
      icon: GraduationCap,
      title: 'Eğitim tamamlanma oranı düşük',
      body: `Planlı eğitimlerin yalnızca %${rateTrain}’si tamamlanmış. Kalite bilinci için takvimi güncelleyin.`,
      actionLabel: 'Eğitimler',
      module: 'training',
    });
  }

  const upcomingTrain = trains.filter((t) => {
    if (t.status === 'Tamamlandı' || !t.start_date) return false;
    const s = new Date(t.start_date);
    return s >= today && s <= new Date(today.getTime() + 14 * 86400000);
  }).length;
  if (upcomingTrain >= 3) {
    pushInsight(list, {
      id: 'training-upcoming',
      tone: 'slate',
      icon: GraduationCap,
      title: 'Yaklaşan eğitimler',
      body: `Önümüzdeki 14 günde ${upcomingTrain} eğitim başlıyor. Katılımcı ve materyal hazırlığını kontrol edin.`,
      actionLabel: 'Eğitim takvimi',
      module: 'training',
    });
  }

  // ——— Görevler ———
  const overdueTasks = (tasks || []).filter(
    (t) => t.due_date && t.status !== 'Tamamlandı' && new Date(t.due_date) < today
  ).length;
  if (overdueTasks >= 3) {
    pushInsight(list, {
      id: 'tasks-overdue',
      tone: 'amber',
      icon: CheckSquare,
      title: 'Vadesi geçmiş görevler',
      body: `${overdueTasks} görevin bitiş tarihi geçmiş. Kalite aksiyonlarında gecikmeyi azaltmak için önceliklendirin.`,
      actionLabel: 'Görevler',
      module: 'tasks',
    });
  }

  const openTasks = (tasks || []).filter((t) => t.status !== 'Tamamlandı').length;
  if (openTasks >= 25) {
    pushInsight(list, {
      id: 'tasks-backlog',
      tone: 'slate',
      icon: ClipboardList,
      title: 'Açık görev birikimi',
      body: `${openTasks} tamamlanmamış görev var. WIP limiti ve öncelik sıralaması ile yükü yönetin.`,
      actionLabel: 'Görev yönetimi',
      module: 'tasks',
    });
  }

  // ——— Karantina ———
  const inQuarantine = (quarantineRecords || []).filter((q) => q.status === 'Karantinada');
  if (inQuarantine.length >= 5) {
    pushInsight(list, {
      id: 'quarantine-many',
      tone: 'amber',
      icon: Beaker,
      title: 'Karantinada yüksek stok',
      body: `${inQuarantine.length} kayıt hâlâ karantinada. Karar ve serbest bırakma süreçlerini hızlandırın.`,
      actionLabel: 'Karantina',
      module: 'quarantine',
    });
  }
  const oldQuarantine = inQuarantine.filter((q) => {
    const d = new Date(q.quarantine_date || q.created_at);
    return differenceInDays(today, d) >= 14;
  }).length;
  if (oldQuarantine >= 1) {
    pushInsight(list, {
      id: 'quarantine-aging',
      tone: 'amber',
      icon: Beaker,
      title: 'Uzun süren karantina kayıtları',
      body: `${oldQuarantine} kayıt 14 günden uzun süredir karantinada. Maliyet ve sevk riski için gözden geçirin.`,
      actionLabel: 'Karantina',
      module: 'quarantine',
    });
  }

  // ——— Girdi kalite ———
  const pendingInsp = (incomingInspections || []).filter((i) => {
    const dec = i.decision || '';
    const st = i.status || '';
    return dec === 'Beklemede' || st === 'Beklemede';
  }).length;
  if (pendingInsp >= 2) {
    pushInsight(list, {
      id: 'incoming-pending',
      tone: 'slate',
      icon: Package,
      title: 'Bekleyen girdi muayeneleri',
      body: `${pendingInsp} muayene kaydı karar bekliyor. Tedarik zincirinde gecikmeyi önlemek için sonuçlandırın.`,
      actionLabel: 'Girdi kalite',
      module: 'incoming-quality',
    });
  }

  const rejectThisMonth = (incomingInspections || []).filter((i) => {
    const d = new Date(i.inspection_date || i.created_at);
    return d >= thisMonthStart && (i.decision === 'Ret' || i.decision === 'Şartlı Kabul');
  }).length;
  if (rejectThisMonth >= 5) {
    pushInsight(list, {
      id: 'incoming-rejects',
      tone: 'amber',
      icon: Package,
      title: 'Bu ay yüksek ret / şartlı kabul',
      body: `Bu ay ${rejectThisMonth} girdi muayenesi ret veya şartlı kabul ile sonuçlandı. Tedarikçi kalite performansını değerlendirin.`,
      actionLabel: 'Girdi kalite',
      module: 'incoming-quality',
    });
  }

  // ——— Kontrol planı özet verisi (sadece part_code + is_current) ———
  const icp = incomingControlPlans || [];
  if (icp.length > 0) {
    const byPart = {};
    icp.forEach((row) => {
      const p = row.part_code || '';
      if (!p) return;
      byPart[p] = (byPart[p] || 0) + 1;
    });
    const multiRev = Object.values(byPart).filter((c) => c > 1).length;
    if (multiRev >= 15) {
      pushInsight(list, {
        id: 'icp-revisions',
        tone: 'slate',
        icon: BookOpen,
        title: 'Kontrol planı revizyon yoğunluğu',
        body: `Birçok parça kodunda birden fazla plan satırı var. Güncel revizyonların işaretlendiğinden emin olun.`,
        actionLabel: 'Kontrol planları',
        module: 'incoming-quality',
      });
    }
  }

  // ——— Proses kontrol planı sayısı ———
  const pcpCount = (processControlPlans || []).length;
  if (pcpCount === 0) {
    pushInsight(list, {
      id: 'pcp-empty',
      tone: 'slate',
      icon: Factory,
      title: 'Aktif proses kontrol planı',
      body: 'Sistemde aktif proses kontrol planı görünmüyor. Üretim hattı ölçümlerini standartlaştırmak için plan ekleyin.',
      actionLabel: 'Proses kontrol',
      module: 'process-control',
    });
  }

  // ——— Tedarikçi uygunsuzlukları ———
  const snc = supplierNonConformities || [];
  const openSnc = snc.filter((x) => isOpenNcLike(x.status)).length;
  if (openSnc >= 3) {
    pushInsight(list, {
      id: 'supplier-nc-open',
      tone: 'amber',
      icon: Truck,
      title: 'Açık tedarikçi uygunsuzlukları',
      body: `${openSnc} adet kapatılmamış tedarikçi uygunsuzluğu var. 8D ve doğrulama aksiyonlarını takip edin.`,
      actionLabel: 'Tedarikçi kalite',
      module: 'supplier-quality',
    });
  }

  // ——— Tedarikçi sertifika süresi ———
  let certExpiring = 0;
  (suppliers || []).forEach((s) => {
    (s.supplier_certificates || []).forEach((c) => {
      if (!c.valid_until) return;
      const v = new Date(c.valid_until);
      if (v >= today && v <= new Date(today.getTime() + 30 * 86400000)) certExpiring += 1;
    });
  });
  if (certExpiring >= 2) {
    pushInsight(list, {
      id: 'supplier-cert-exp',
      tone: 'amber',
      icon: ScrollText,
      title: 'Süresi dolacak tedarikçi sertifikaları',
      body: `${certExpiring} sertifika önümüzdeki 30 günde sona eriyor. Onaylı tedarikçi listesini güncel tutun.`,
      actionLabel: 'Tedarikçiler',
      module: 'supplier-quality',
    });
  }

  // ——— Müşteri şikayetleri ———
  const complaints = customerComplaints || [];
  const openComplaints = complaints.filter(
    (c) => c.status && !['Kapalı', 'İptal'].includes(c.status)
  ).length;
  if (openComplaints >= 4) {
    pushInsight(list, {
      id: 'complaints-open',
      tone: 'amber',
      icon: MessageSquare,
      title: 'Açık müşteri şikayetleri',
      body: `${openComplaints} adet kapatılmamış şikayet var. SLA ve müşteri memnuniyeti için kapanışları izleyin.`,
      actionLabel: 'Şikayetler',
      module: 'customer-complaints',
    });
  }

  const critComplaints = complaints.filter(
    (c) =>
      (c.severity === 'Kritik' || c.severity === 'Yüksek') &&
      c.status &&
      !['Kapalı', 'İptal'].includes(c.status)
  ).length;
  if (critComplaints >= 1) {
    pushInsight(list, {
      id: 'complaints-severe',
      tone: 'red',
      icon: MessageSquare,
      title: 'Kritik / yüksek şikayetler',
      body: `${critComplaints} adet yüksek öncelikli açık şikayet mevcut. Öncelikli müdahale önerilir.`,
      actionLabel: 'Şikayetler',
      module: 'customer-complaints',
    });
  }

  // ——— Kaizen ———
  const kaizens = kaizenEntries || [];
  const taslak = kaizens.filter((k) => k.status === 'Taslak').length;
  if (taslak >= 5) {
    pushInsight(list, {
      id: 'kaizen-draft',
      tone: 'slate',
      icon: Sparkles,
      title: 'Taslak Kaizen birikimi',
      body: `${taslak} Kaizen taslağı onay veya uygulama aşamasına alınmayı bekliyor.`,
      actionLabel: 'Kaizen',
      module: 'kaizen',
    });
  }
  const uygulamada = kaizens.filter((k) => k.status === 'Uygulamada').length;
  if (uygulamada >= 4) {
    pushInsight(list, {
      id: 'kaizen-wip',
      tone: 'slate',
      icon: Sparkles,
      title: 'Devam eden Kaizen çalışmaları',
      body: `${uygulamada} Kaizen uygulama aşamasında. Etkinlikleri ve standartlaştırmayı tamamlayın.`,
      actionLabel: 'Kaizen',
      module: 'kaizen',
    });
  }

  // ——— KPI ———
  const kpiList = kpis || [];
  const staleKpi = kpiList.filter((k) => {
    if (!k.updated_at) return false;
    return differenceInDays(today, new Date(k.updated_at)) > 60;
  }).length;
  if (staleKpi >= 3 && kpiList.length >= 3) {
    pushInsight(list, {
      id: 'kpi-stale',
      tone: 'slate',
      icon: BarChart2,
      title: 'Güncellenmemiş KPI’lar',
      body: `${staleKpi} KPI kaydının güncellemesi 60 günden eski. Yönetim gözden geçirmesi için veri tazeliği önemlidir.`,
      actionLabel: 'KPI modülü',
      module: 'kpi',
    });
  }

  // ——— Tetkik bulguları (bağlı NC açıksa bulgu açık sayılır) ———
  const findings = auditFindings || [];
  const ncFromFinding = (f) => {
    if (f.non_conformities) {
      const arr = Array.isArray(f.non_conformities) ? f.non_conformities : [f.non_conformities];
      return arr[0] || null;
    }
    if (f.non_conformity) {
      const arr = Array.isArray(f.non_conformity) ? f.non_conformity : [f.non_conformity];
      return arr[0] || null;
    }
    return null;
  };
  const openFindings = findings.filter((f) => {
    const nc = ncFromFinding(f);
    return nc && nc.status !== 'Kapatıldı';
  }).length;
  if (openFindings >= 5) {
    pushInsight(list, {
      id: 'findings-open',
      tone: 'amber',
      icon: ScrollText,
      title: 'Kapatılmamış tetkik bulguları',
      body: `${openFindings} bulgu için kapanış veya aksiyon takibi sürüyor. İç tetkik etkinliğini tamamlayın.`,
      actionLabel: 'İç tetkik',
      module: 'internal-audit',
    });
  }

  // ——— Kaliteye verilen araçlar ———
  const vehicles = producedVehicles || [];
  const pipelineStatuses = [
    'Kaliteye Girdi',
    'Kontrol Başladı',
    'Kontrol Bitti',
    'Yeniden İşlemde',
    "Ar-Ge'de",
    'Sevk Bilgisi Bekleniyor',
    'Sevk Hazır',
  ];
  const inPipeline = vehicles.filter((v) => pipelineStatuses.includes(v.status)).length;
  if (inPipeline >= 15) {
    pushInsight(list, {
      id: 'vehicles-pipeline',
      tone: 'slate',
      icon: Car,
      title: 'Kalite hattında yoğunluk',
      body: `${inPipeline} araç aktif kalite sürecinde. Darboğazları ve öncelikli müşteri siparişlerini gözden geçirin.`,
      actionLabel: 'Kaliteye verilen araçlar',
      module: 'produced-vehicles',
    });
  }

  const oldVehicles = vehicles.filter((v) => {
    if (v.status === 'Sevk Edildi' || v.status === 'Kapatıldı') return false;
    const d = new Date(v.updated_at || v.created_at);
    return differenceInDays(today, d) >= 21;
  }).length;
  if (oldVehicles >= 5) {
    pushInsight(list, {
      id: 'vehicles-aging',
      tone: 'amber',
      icon: Car,
      title: 'Uzun süren kalite kontrolleri',
      body: `${oldVehicles} araç kaydı 3 haftadan uzun süredir açık. Darboğazları ve süreç adımlarını kontrol edin.`,
      actionLabel: 'Araçlar',
      module: 'produced-vehicles',
    });
  }

  // ——— Stok risk kontrolleri ———
  const risks = stockRiskControls || [];
  const openRisks = risks.filter((r) => (r.status || '') !== 'Tamamlandı').length;
  if (openRisks >= 3) {
    pushInsight(list, {
      id: 'stock-risk-open',
      tone: 'amber',
      icon: Package,
      title: 'Açık stok risk kontrolleri',
      body: `${openRisks} risk kaydı sonuçlandırılmayı bekliyor. Girdi kalite ile koordine edin.`,
      actionLabel: 'Girdi kalite / stok risk',
      module: 'incoming-quality',
    });
  }

  // ——— İNKR ———
  const inkrs = inkrReports || [];
  const openInkr = inkrs.filter((r) => (r.status || '') === 'Beklemede').length;
  if (openInkr >= 3) {
    pushInsight(list, {
      id: 'inkr-open',
      tone: 'slate',
      icon: FileWarning,
      title: 'Açık İNKR raporları',
      body: `${openInkr} İNKR kaydı kapatılmamış. İzlenebilirlik ve müşteri bilgilendirmesini tamamlayın.`,
      actionLabel: 'İNKR',
      module: 'incoming-quality',
    });
  }

  // ——— Kalite maliyeti (yumuşak sinyal, kritik karttan farklı) ———
  const costs = qualityCosts || [];
  const isInternalCost = (c) => (c.cost_type || '').toLowerCase().includes('iç');
  const internalThis = costs.filter(
    (c) => new Date(c.cost_date) >= thisMonthStart && isInternalCost(c)
  ).length;
  const internalLast = costs.filter((c) => {
    const d = new Date(c.cost_date);
    return d >= lastMonthStart && d <= lastMonthEnd && isInternalCost(c);
  }).length;
  if (internalLast > 0 && internalThis > internalLast * 1.4) {
    pushInsight(list, {
      id: 'cost-internal-up',
      tone: 'amber',
      icon: Gauge,
      title: 'İç hata maliyeti artışı',
      body: 'Bu ay iç hata kayıtları geçen aya göre belirgin şekilde arttı. Pareto ve kök neden analizi yapın.',
      actionLabel: 'Kalite maliyetleri',
      module: 'quality-cost',
    });
  }

  // ——— Doküman (geçerlilik tarihi olmayan) ———
  const docs = documents || [];
  const noValidity = docs.filter((d) => (d.document_type || '') !== 'Kayıt' && !d.valid_until).length;
  if (noValidity >= 10 && docs.length >= 15) {
    pushInsight(list, {
      id: 'docs-no-expiry',
      tone: 'slate',
      icon: BookOpen,
      title: 'Geçerlilik tarihi eksik dokümanlar',
      body: `${noValidity} dokümanda son geçerlilik tarihi yok. Prosedür ve talimatlarda izlenebilirlik için tanımlayın.`,
      actionLabel: 'Doküman yönetimi',
      module: 'document',
    });
  }

  // ——— Ekipman envanteri ———
  const eqCount = (equipments || []).length;
  if (eqCount > 0) {
    const noCal = (equipments || []).filter(
      (e) => !(e.equipment_calibrations && e.equipment_calibrations.length)
    ).length;
    if (noCal >= 3) {
      pushInsight(list, {
        id: 'equip-no-cal',
        tone: 'amber',
        icon: Users,
        title: 'Kalibrasyon geçmişi olmayan ekipmanlar',
        body: `${noCal} ekipmanda hiç kalibrasyon kaydı yok. Ölçüm güvenilirliği için plan oluşturun.`,
        actionLabel: 'Ekipman',
        module: 'equipment',
      });
    }
  }

  // ——— Denetim kayıtları hacmi (son 7 gün) ———
  const logs = auditLogs || [];
  const weekLogs = logs.filter((l) => new Date(l.created_at) >= new Date(today.getTime() - 7 * 86400000)).length;
  if (logs.length >= 500 && weekLogs > 200) {
    pushInsight(list, {
      id: 'audit-log-volume',
      tone: 'slate',
      icon: ScrollText,
      title: 'Yüksek denetim kaydı trafiği',
      body: `Son 7 günde ${weekLogs} sistem işlemi loglandı. Kritik tablolarda istisnai hareketleri denetim modülünden süzün.`,
      actionLabel: 'Denetim kayıtları',
      module: 'audit-logs',
    });
  }

  // Öncelik: red > amber > slate
  const toneOrder = { red: 0, amber: 1, slate: 2 };
  list.sort((a, b) => (toneOrder[a.tone] ?? 3) - (toneOrder[b.tone] ?? 3));

  return list;
}
