import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/lib/customSupabaseClient';
import { generatePrintableReportHtml, getReportTitle } from '@/lib/reportUtils';
import { buildMeasurementBundle } from '@/components/process-control/processInspectionUtils';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';

const PrintableReport = () => {
    const { type, id } = useParams();
    const location = useLocation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reportTitle, setReportTitle] = useState('Rapor Yükleniyor...');
    const [blobUrl, setBlobUrl] = useState(null);
    const iframeRef = useRef(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        let recordData = null;
        let queryError = null;

        try {
            const urlParams = new URLSearchParams(location.search);
            const storageKey = urlParams.get('storageKey');
            const useUrlParams = urlParams.get('useUrlParams') === 'true';

            // Önce localStorage'dan kontrol et (tab'ler arası çalışır)
            if (storageKey) {
                const storedData = localStorage.getItem(storageKey);
                if (storedData) {
                    try {
                        recordData = JSON.parse(storedData);
                        console.log('✅ Rapor verisi localStorage\'dan başarıyla okundu:', storageKey);
                        console.log('DEBUG: NC Report record:', {
                            due_at: recordData.due_at,
                            due_date: recordData.due_date,
                            attachments: recordData.attachments,
                            closing_attachments: recordData.closing_attachments,
                            supplier_name: recordData.supplier_name
                        });

                        // Liste tipleri için localStorage'dan veri okunduysa direkt kullan
                        if (type.endsWith('_list') || type === 'document_list' || type === 'equipment_list' || type === 'quality_cost_executive_summary' || type === 'incoming_quality_executive_summary' || type === 'produced_vehicles_executive_summary' || type === 'supplier_quality_executive_summary') {
                            // Liste tipleri için ek işlem gerekmez, veri zaten hazır
                            console.log(`✅ Liste tipi (${type}) verisi localStorage'dan okundu`);
                        }
                        // quality_cost_detail: _documents eksikse quality_cost_documents'tan çek (kanıt dokümanlar link için)
                        else if (type === 'quality_cost_detail' && recordData?.id) {
                            const hasDocs = recordData._documents && Array.isArray(recordData._documents) && recordData._documents.length > 0;
                            if (!hasDocs) {
                                try {
                                    const { data: docsData } = await supabase
                                        .from('quality_cost_documents')
                                        .select('*')
                                        .eq('quality_cost_id', recordData.id);
                                    if (docsData && docsData.length > 0) {
                                        const docsWithUrls = await Promise.all(docsData.map(async (doc) => {
                                            // quality_costs bucket private - createSignedUrl kullan (getPublicUrl 404 verir)
                                            const { data: urlData, error } = await supabase.storage.from('quality_costs').createSignedUrl(doc.file_path, 3600);
                                            return {
                                                document_name: doc.document_name,
                                                document_type: doc.document_type,
                                                file_path: doc.file_path,
                                                file_size: doc.file_size,
                                                url: (!error && urlData?.signedUrl) ? urlData.signedUrl : '#'
                                            };
                                        }));
                                        recordData._documents = docsWithUrls;
                                        console.log('✅ Kalite maliyeti kanıt dokümanları veritabanından yüklendi:', docsWithUrls.length);
                                    }
                                } catch (docsErr) {
                                    console.warn('Kanıt dokümanları yüklenemedi:', docsErr);
                                }
                            }
                        }
                        // WPS için ilişkili verileri kontrol et ve eksikse çek
                        else if (type === 'wps' && recordData && id) {
                            console.log('🔍 WPS tipi tespit edildi, ilişkili veriler kontrol ediliyor...');

                            // İlişkili veriler eksikse veritabanından çek
                            if (!recordData.base_material_1 || !recordData.base_material_2 || !recordData.filler_material || !recordData.shielding_gas) {
                                console.log('⚠️ WPS ilişkili veriler eksik, veritabanından çekiliyor...');
                                const { data: wpsData, error: wpsError } = await supabase
                                    .from('wps_procedures')
                                    .select(`
                                        *,
                                        base_material_1:base_material_1_id!left(*),
                                        base_material_2:base_material_2_id!left(*),
                                        filler_material:filler_material_id!left(*),
                                        shielding_gas:shielding_gas_id!left(*)
                                    `)
                                    .eq('id', id)
                                    .maybeSingle();

                                if (!wpsError && wpsData) {
                                    // Mevcut veriyi koru, sadece eksik ilişkili verileri ekle
                                    recordData = {
                                        ...recordData,
                                        base_material_1: wpsData.base_material_1 || recordData.base_material_1,
                                        base_material_2: wpsData.base_material_2 || recordData.base_material_2,
                                        filler_material: wpsData.filler_material || recordData.filler_material,
                                        shielding_gas: wpsData.shielding_gas || recordData.shielding_gas,
                                    };
                                    console.log('✅ WPS ilişkili veriler eklendi');
                                } else {
                                    console.error('❌ WPS ilişkili veriler yüklenirken hata:', wpsError);
                                }
                            } else {
                                console.log('✅ WPS ilişkili veriler zaten mevcut');
                            }
                        }
                        // Sapma: localStorage'a özet yazıldıysa (ör. girdi modülü) rapor = sapma modülü ile aynı olsun
                        else if (type === 'deviation' && recordData?.id) {
                            try {
                                const { data: fullDeviation, error: devErr } = await supabase
                                    .from('deviations')
                                    .select(
                                        '*, deviation_approvals!left(*), deviation_vehicles!left(*), deviation_attachments!left(*)'
                                    )
                                    .eq('id', recordData.id)
                                    .maybeSingle();

                                if (!devErr && fullDeviation) {
                                    recordData = fullDeviation;
                                    console.log('✅ Sapma raporu tam kayıt ile güncellendi (onaylar, ekler, araçlar)');
                                }
                            } catch (devFetchErr) {
                                console.warn('Sapma tam kayıt yenilenemedi:', devFetchErr);
                            }
                        }
                        // ÖNEMLİ: Nonconformity için attachments ve closing_attachments kontrolü
                        // localStorage'dan gelen veride bu alanlar undefined olabilir
                        else if (type === 'nonconformity' && id) {
                            console.log('🔍 Nonconformity tipi tespit edildi, attachments ve kök neden analizleri kontrol ediliyor...');

                            // supplier_name yoksa çek
                            if (!recordData.supplier_name && recordData.supplier_id) {
                                const { data: supplierData } = await supabase
                                    .from('suppliers')
                                    .select('name')
                                    .eq('id', recordData.supplier_id)
                                    .maybeSingle();

                                if (supplierData) {
                                    recordData.supplier_name = supplierData.name;
                                    console.log('✅ Tedarikçi adı eklendi:', supplierData.name);
                                }
                            }

                            // Kök neden analizleri kontrol et ve eksikse veritabanından çek
                            const hasAnalysisData = recordData.five_n1k_analysis || recordData.five_why_analysis ||
                                recordData.ishikawa_analysis || recordData.fta_analysis;

                            // attachments veya closing_attachments undefined ise veritabanından çek
                            if (recordData.attachments === undefined || recordData.closing_attachments === undefined || !hasAnalysisData) {
                                console.log('⚠️ Attachments veya kök neden analizleri undefined, veritabanından çekiliyor...');
                                const { data: freshData, error: attachError } = await supabase
                                    .from('non_conformities')
                                    .select('attachments, closing_attachments, five_n1k_analysis, five_why_analysis, ishikawa_analysis, fta_analysis')
                                    .eq('id', id)
                                    .maybeSingle();

                                if (!attachError && freshData) {
                                    recordData.attachments = freshData.attachments || [];
                                    recordData.closing_attachments = freshData.closing_attachments || [];

                                    // Kök neden analizleri varsa ekle
                                    if (freshData.five_n1k_analysis) {
                                        recordData.five_n1k_analysis = freshData.five_n1k_analysis;
                                        console.log('✅ five_n1k_analysis veritabanından yüklendi');
                                    }
                                    if (freshData.five_why_analysis) {
                                        recordData.five_why_analysis = freshData.five_why_analysis;
                                        console.log('✅ five_why_analysis veritabanından yüklendi');
                                    }
                                    if (freshData.ishikawa_analysis) {
                                        recordData.ishikawa_analysis = freshData.ishikawa_analysis;
                                        console.log('✅ ishikawa_analysis veritabanından yüklendi');
                                    }
                                    if (freshData.fta_analysis) {
                                        recordData.fta_analysis = freshData.fta_analysis;
                                        console.log('✅ fta_analysis veritabanından yüklendi');
                                    }

                                    console.log('✅ Attachments ve kök neden analizleri veritabanından yüklendi:', {
                                        attachments: recordData.attachments?.length || 0,
                                        closing_attachments: recordData.closing_attachments?.length || 0,
                                        hasFiveN1K: !!recordData.five_n1k_analysis,
                                        hasFiveWhy: !!recordData.five_why_analysis,
                                        hasIshikawa: !!recordData.ishikawa_analysis,
                                        hasFTA: !!recordData.fta_analysis
                                    });
                                } else {
                                    console.error('❌ Attachments veya kök neden analizleri yüklenirken hata:', attachError);
                                }
                            } else {
                                console.log('✅ Attachments ve kök neden analizleri zaten mevcut:', {
                                    attachments: recordData.attachments?.length || 0,
                                    closing_attachments: recordData.closing_attachments?.length || 0,
                                    hasFiveN1K: !!recordData.five_n1k_analysis,
                                    hasFiveWhy: !!recordData.five_why_analysis,
                                    hasIshikawa: !!recordData.ishikawa_analysis,
                                    hasFTA: !!recordData.fta_analysis
                                });
                            }
                        }

                        // NOT: localStorage'ı temizleme - openPrintableReport fonksiyonu 30 saniye sonra temizleyecek
                        // Burada temizlersek yavaş bağlantılarda veri kaybolur
                    } catch (e) {
                        console.error('localStorage verisi okunurken hata:', e);
                        throw new Error('Rapor verisi okunamadı. Lütfen tekrar deneyin.');
                    }
                } else {
                    throw new Error('Rapor verisi bulunamadı. Lütfen sayfayı yenileyerek tekrar deneyin.');
                }
            } else if (useUrlParams) {
                // Fallback: Eski URL params yöntemi (geriye dönük uyumluluk)
                const encodedData = urlParams.get('data');
                if (encodedData) {
                    try {
                        recordData = JSON.parse(decodeURIComponent(atob(encodedData)));
                    } catch (e) {
                        console.error('URL verisi okunurken hata:', e);
                        throw new Error('URL\'den rapor verisi okunurken bir hata oluştu. Veri formatı bozuk olabilir.');
                    }
                } else {
                    throw new Error('URL parametrelerinde veri bulunamadı.');
                }
            } else {
                switch (type) {
                    case 'certificate': {
                        const urlParams = new URLSearchParams(window.location.search);
                        recordData = {
                            id: id,
                            personnelName: urlParams.get('personnelName') || 'İsim Bulunamadı',
                            trainingTitle: urlParams.get('trainingTitle') || 'Eğitim Bulunamadı',
                            trainingInstructor: urlParams.get('trainingInstructor') || '',
                            score: urlParams.get('score') || '',
                            completedAt: urlParams.get('completedAt') || '',
                            status: urlParams.get('status') || '',
                            certificateType: urlParams.get('certificateType') || 'success' // 'success' veya 'participation'
                        };
                        break;
                    }
                    case 'supplier_audit': {
                        const { data: auditData, error: auditError } = await supabase
                            .from('supplier_audit_plans')
                            .select('*, supplier:supplier_id!left(name)')
                            .eq('id', id)
                            .maybeSingle();

                        // Soruları da çek
                        const { data: questionsData, error: questionsError } = await supabase
                            .from('supplier_audit_questions')
                            .select('*')
                            .order('created_at', { ascending: true });

                        if (questionsError) {
                            console.error('Sorular yüklenirken hata:', questionsError);
                        }

                        recordData = {
                            ...auditData,
                            questions: questionsData || []
                        };
                        queryError = auditError;
                        break;
                    }
                    case 'internal_audit': {
                        const { data: auditData, error: auditError } = await supabase
                            .from('audits')
                            .select(`
                                *,
                                department:department_id!left(unit_name),
                                audit_standard:audit_standards!audit_standard_id(id, code, name),
                                audit_results:audit_results!left(*)
                            `)
                            .eq('id', id)
                            .maybeSingle();
                        recordData = auditData;
                        queryError = auditError;
                        break;
                    }
                    case 'sheet_metal_entry': {
                        // URL parametresiyle gelen data'yı kullan (useUrlParams=true olduğunda)
                        if (!recordData) throw new Error('Sac malzeme giriş verisi bulunamadı.');
                        break;
                    }
                    case 'incoming_inspection': {
                        const { data: inspectionData, error: inspectionError } = await supabase
                            .from('incoming_inspections_with_supplier')
                            .select('*')
                            .eq('id', id)
                            .maybeSingle();

                        if (inspectionError) throw inspectionError;
                        if (!inspectionData) throw new Error('Muayene kaydı bulunamadı.');

                        // Related data'yı ayrı ayrı çek
                        const [attachmentsRes, defectsRes, resultsRes, stockRiskControlsRes] = await Promise.all([
                            supabase.from('incoming_inspection_attachments').select('*').eq('inspection_id', id),
                            supabase.from('incoming_inspection_defects').select('*').eq('inspection_id', id),
                            supabase.from('incoming_inspection_results').select('*').eq('inspection_id', id),
                            supabase.from('stock_risk_controls').select('id, status, decision, created_at').eq('source_inspection_id', id)
                        ]);

                        recordData = {
                            ...inspectionData,
                            attachments: attachmentsRes.data || [],
                            defects: defectsRes.data || [],
                            results: resultsRes.data || [],
                            stock_risk_controls: stockRiskControlsRes.data || []
                        };

                        // Measurement numbers regenerate et (eski kayıtlarda NULL olabilir)
                        if (recordData.results && recordData.results.length > 0) {
                            const hasNullMeasurements = recordData.results.some(
                                r => !r.measurement_number || !r.total_measurements
                            );

                            if (hasNullMeasurements) {
                                const { data: controlPlan } = await supabase
                                    .from('incoming_control_plans')
                                    .select('*')
                                    .eq('part_code', inspectionData.part_code)
                                    .maybeSingle();

                                if (controlPlan?.items) {
                                    recordData.results = recordData.results.map(r => {
                                        if (r.measurement_number && r.total_measurements) {
                                            return r;
                                        }

                                        const planItem = controlPlan.items?.find(
                                            item => item.id === r.control_plan_item_id
                                        );

                                        const incomingQuantity = inspectionData.quantity_received || 1;
                                        const samplingSize = planItem?.sample_size || incomingQuantity;

                                        return {
                                            ...r,
                                            measurement_number: r.measurement_number || 1,
                                            total_measurements: r.total_measurements || samplingSize,
                                        };
                                    });
                                }
                            }
                        }
                        break;
                    }
                    case 'process_inspection': {
                        if (!recordData) {
                            const { data: inspectionData, error: inspectionError } = await supabase
                                .from('process_inspections')
                                .select('*')
                                .eq('id', id)
                                .maybeSingle();

                            if (inspectionError) throw inspectionError;
                            if (!inspectionData) throw new Error('Proses muayene kaydı bulunamadı.');

                            const [attachmentsRes, defectsRes, resultsRes] = await Promise.all([
                                supabase.from('process_inspection_attachments').select('*').eq('inspection_id', id),
                                supabase.from('process_inspection_defects').select('*').eq('inspection_id', id),
                                supabase.from('process_inspection_results').select('*').eq('inspection_id', id),
                            ]);

                            recordData = {
                                ...inspectionData,
                                attachments: attachmentsRes.data || [],
                                defects: defectsRes.data || [],
                                results: resultsRes.data || [],
                            };
                        } else {
                            recordData = {
                                ...recordData,
                                attachments: recordData.attachments || [],
                                defects: recordData.defects || [],
                                results: recordData.results || [],
                            };
                        }

                        const [controlPlanRes, characteristicsRes, equipmentRes] = await Promise.all([
                            recordData.part_code
                                ? supabase
                                      .from('process_control_plans')
                                      .select('items')
                                      .eq('part_code', recordData.part_code)
                                      .order('revision_number', { ascending: false })
                                      .limit(1)
                                      .maybeSingle()
                                : Promise.resolve({ data: null, error: null }),
                            supabase.from('characteristics').select('id, name, type, sampling_rate'),
                            supabase.from('measurement_equipment').select('id, name').order('name', { ascending: true }),
                        ]);

                        if (controlPlanRes.error) throw controlPlanRes.error;
                        if (characteristicsRes.error) throw characteristicsRes.error;
                        if (equipmentRes.error) throw equipmentRes.error;

                        const bundle = buildMeasurementBundle({
                            controlPlan: controlPlanRes.data || null,
                            quantityProduced: Number(recordData.quantity_produced) || 0,
                            characteristics: (characteristicsRes.data || []).map((item) => ({
                                value: item.id,
                                label: item.name,
                                type: item.type,
                                sampling_rate: item.sampling_rate,
                            })),
                            equipment: (equipmentRes.data || []).map((item) => ({
                                value: item.id,
                                label: item.name,
                            })),
                            existingRows: recordData.results || [],
                        });

                        recordData = {
                            ...recordData,
                            results: bundle.results || [],
                            quantity_accepted:
                                recordData.quantity_accepted ??
                                Math.max(
                                    (Number(recordData.quantity_produced) || 0) -
                                        (Number(recordData.quantity_rejected) || 0) -
                                        (Number(recordData.quantity_conditional) || 0),
                                    0
                                ),
                            status: recordData.decision || recordData.status || 'Beklemede',
                        };
                        break;
                    }

                    case 'inkr_management': {
                        // INKR için karakteristik ve ekipman isimlerini ekle
                        if (recordData?.items && Array.isArray(recordData.items)) {
                            const { data: characteristicsData } = await supabase
                                .from('characteristics')
                                .select('id, name');
                            const { data: equipmentData } = await supabase
                                .from('measurement_equipment')
                                .select('id, name');

                            const characteristicsMap = new Map((characteristicsData || []).map(c => [c.id, c.name]));
                            const equipmentMap = new Map((equipmentData || []).map(e => [e.id, e.name]));

                            recordData.items = recordData.items.map(item => ({
                                ...item,
                                characteristic_name: item.characteristic_name || characteristicsMap.get(item.characteristic_id) || item.characteristic_id || '-',
                                equipment_name: item.equipment_name || equipmentMap.get(item.equipment_id) || item.equipment_id || '-'
                            }));
                        }
                        break;
                    }
                    case 'incoming_control_plans':
                    case 'stock_risk_controls': {
                        const tableMap = {
                            'incoming_control_plans': 'incoming_control_plans',
                            'inkr_management': 'inkr_management',
                            'stock_risk_controls': 'stock_risk_controls'
                        };
                        const tableName = tableMap[type];

                        const { data: queryData, error: queryError2 } = await supabase
                            .from(tableName)
                            .select('*')
                            .eq('id', id)
                            .maybeSingle();

                        if (queryError2) throw queryError2;
                        recordData = queryData;
                        break;
                    }
                    case 'deviation':
                    case 'quarantine':
                    case 'nonconformity':
                    case 'nonconformity_record':
                    case 'equipment':
                    case 'dynamic_balance': {
                        // Check if data is already provided via URL params
                        const urlParams = new URLSearchParams(location.search);
                        const useUrlParamsForThis = urlParams.get('useUrlParams') === 'true';

                        if (useUrlParamsForThis && urlParams.get('data')) {
                            // Data already fetched from URL params above
                            break;
                        }

                        const tableNameMap = {
                            incoming_inspection: 'incoming_inspections',
                            deviation: 'deviations',
                            quarantine: 'quarantine_records',
                            nonconformity: 'non_conformities',
                            nonconformity_record: 'nonconformity_records',
                            equipment: 'equipments',
                            dynamic_balance: 'fan_balance_records',
                        };
                        const tableName = tableNameMap[type];
                        if (!tableName) throw new Error(`Geçersiz rapor türü: ${type}`);

                        let selectQuery = '*';
                        if (type === 'equipment') {
                            selectQuery = '*, equipment_calibrations!left(*)';
                        } else if (type === 'deviation') {
                            selectQuery = '*, deviation_approvals!left(*), deviation_vehicles!left(*), deviation_attachments!left(*)';
                        } else if (type === 'inkr_management') {
                            selectQuery = '*, inkr_attachments!left(*)';
                        } else if (type === 'nonconformity') {
                            // Nonconformity için tüm alanları dahil et (attachments ve closing_attachments JSONB olarak tabloda)
                            selectQuery = '*';
                        } else if (type === 'dynamic_balance') {
                            selectQuery = '*, fan_products(product_code, product_name)';
                        }

                        const { data: queryData, error: queryError2 } = await supabase
                            .from(tableName)
                            .select(selectQuery)
                            .eq('id', id)
                            .maybeSingle();

                        if (queryError2) throw queryError2;
                        recordData = queryData;

                        // Deviation için deviation_vehicles ve deviation_attachments'ı kontrol et ve çek
                        if (type === 'deviation' && recordData) {
                            // Eğer deviation_vehicles yoksa veya boşsa, ayrı çek
                            if (!recordData.deviation_vehicles || recordData.deviation_vehicles.length === 0) {
                                const { data: vehiclesData } = await supabase
                                    .from('deviation_vehicles')
                                    .select('*')
                                    .eq('deviation_id', id);
                                if (vehiclesData && vehiclesData.length > 0) {
                                    recordData.deviation_vehicles = vehiclesData;
                                }
                            }

                            // Eğer deviation_attachments yoksa veya boşsa, ayrı çek
                            if (!recordData.deviation_attachments || recordData.deviation_attachments.length === 0) {
                                const { data: attachmentsData } = await supabase
                                    .from('deviation_attachments')
                                    .select('*')
                                    .eq('deviation_id', id);
                                if (attachmentsData && attachmentsData.length > 0) {
                                    recordData.deviation_attachments = attachmentsData;
                                }
                            }
                        }

                        // INKR için inkr_attachments'ı kontrol et ve çek
                        if (type === 'inkr_management' && recordData) {
                            // Eğer inkr_attachments yoksa veya boşsa, ayrı çek
                            if (!recordData.inkr_attachments || recordData.inkr_attachments.length === 0) {
                                const { data: attachmentsData } = await supabase
                                    .from('inkr_attachments')
                                    .select('*')
                                    .eq('inkr_report_id', id);
                                if (attachmentsData && attachmentsData.length > 0) {
                                    recordData.inkr_attachments = attachmentsData;
                                }
                            }
                        }

                        // Nonconformity için tedarikçi adını, attachments'ları ve kök neden analizlerini çek
                        if (type === 'nonconformity' && recordData) {
                            if (recordData.supplier_id) {
                                const { data: supplierData } = await supabase
                                    .from('suppliers')
                                    .select('name')
                                    .eq('id', recordData.supplier_id)
                                    .maybeSingle();

                                if (supplierData) {
                                    recordData.supplier_name = supplierData.name;
                                }
                            }

                            // Kök neden analizleri kontrol et
                            const hasAnalysisData = recordData.five_n1k_analysis || recordData.five_why_analysis ||
                                recordData.ishikawa_analysis || recordData.fta_analysis;

                            // Eğer attachments, closing_attachments veya kök neden analizleri yoksa,
                            // veritabanından çek
                            if (recordData.attachments === undefined || recordData.closing_attachments === undefined || !hasAnalysisData) {
                                const { data: freshData } = await supabase
                                    .from('non_conformities')
                                    .select('attachments, closing_attachments, five_n1k_analysis, five_why_analysis, ishikawa_analysis, fta_analysis')
                                    .eq('id', id)
                                    .maybeSingle();

                                if (freshData) {
                                    recordData.attachments = freshData.attachments || [];
                                    recordData.closing_attachments = freshData.closing_attachments || [];

                                    // Kök neden analizleri varsa ekle
                                    if (freshData.five_n1k_analysis) {
                                        recordData.five_n1k_analysis = freshData.five_n1k_analysis;
                                    }
                                    if (freshData.five_why_analysis) {
                                        recordData.five_why_analysis = freshData.five_why_analysis;
                                    }
                                    if (freshData.ishikawa_analysis) {
                                        recordData.ishikawa_analysis = freshData.ishikawa_analysis;
                                    }
                                    if (freshData.fta_analysis) {
                                        recordData.fta_analysis = freshData.fta_analysis;
                                    }
                                }
                            }
                        }
                        break;
                    }
                    case 'kaizen': {
                        const { data: kaizenData, error: kaizenError } = await supabase
                            .from('kaizen_entries')
                            .select('*, proposer:proposer_id!left(full_name), responsible_person:responsible_person_id!left(full_name), department:department_id!left(unit_name)')
                            .eq('id', id)
                            .maybeSingle();

                        if (kaizenError) throw kaizenError;
                        recordData = kaizenData;

                        if (recordData && recordData.team_members && Array.isArray(recordData.team_members) && recordData.team_members.length > 0) {
                            const { data: profiles, error: profilesError } = await supabase
                                .from('personnel')
                                .select('id, full_name')
                                .in('id', recordData.team_members);
                            if (profilesError) throw profilesError;
                            recordData.team_members_profiles = profiles;
                        } else if (recordData) {
                            recordData.team_members_profiles = [];
                        }
                        break;
                    }
                    case 'exam_paper': {
                        const { data: examData, error: examError } = await supabase
                            .from('training_exams')
                            .select('*, trainings:training_id!left(title), training_exam_questions!left(*)')
                            .eq('id', id)
                            .maybeSingle();
                        recordData = examData;
                        queryError = examError;
                        break;
                    }
                    case 'wps': {
                        const { data: wpsData, error: wpsError } = await supabase
                            .from('wps_procedures')
                            .select(`
                                *,
                                base_material_1:base_material_1_id!left(*),
                                base_material_2:base_material_2_id!left(*),
                                filler_material:filler_material_id!left(*),
                                shielding_gas:shielding_gas_id!left(*)
                            `)
                            .eq('id', id)
                            .maybeSingle();

                        if (wpsError) throw wpsError;
                        if (!wpsData) throw new Error('WPS kaydı bulunamadı.');

                        recordData = wpsData;
                        break;
                    }
                    case 'quality_cost_list':
                    case 'quality_cost_executive_summary':
                    case 'quality_cost_detail':
                    case 'incoming_quality_executive_summary':
                    case 'produced_vehicles_executive_summary':
                    case 'supplier_quality_executive_summary': {
                        // Bu tipler localStorage'dan veri çekiyor, buraya gelmemeli
                        // Ancak fallback olarak burada da kontrol edelim
                        if (!recordData) {
                            let errorMsg = 'Rapor verisi bulunamadı. Lütfen tekrar deneyin.';
                            if (type === 'incoming_quality_executive_summary') {
                                errorMsg = 'Girdi kalite kontrol rapor verisi bulunamadı. Lütfen tekrar deneyin.';
                            } else if (type === 'produced_vehicles_executive_summary') {
                                errorMsg = 'Üretilen araçlar rapor verisi bulunamadı. Lütfen tekrar deneyin.';
                            } else if (type === 'quality_cost_executive_summary') {
                                errorMsg = 'Kalite maliyeti rapor verisi bulunamadı. Lütfen tekrar deneyin.';
                            } else if (type === 'quality_cost_detail') {
                                errorMsg = 'Kalite maliyeti detay rapor verisi bulunamadı. Lütfen tekrar deneyin.';
                            } else if (type === 'supplier_quality_executive_summary') {
                                errorMsg = 'Tedarikçi kalite yönetimi rapor verisi bulunamadı. Lütfen tekrar deneyin.';
                            }
                            throw new Error(errorMsg);
                        }
                        break;
                    }

                    default:
                        throw new Error(`Geçersiz rapor türü: ${type}`);
                }
            }

            if (queryError) throw queryError;
            if (!recordData) throw new Error('Kayıt bulunamadı. Rapor oluşturulamıyor.');

            setData(recordData);
            setReportTitle(getReportTitle(recordData, type));

        } catch (err) {
            console.error("Rapor oluşturulurken hata:", err);
            setError(`Rapor oluşturulurken hata: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [type, id, location.search]);

    useEffect(() => {
        if (data) {
            let url = null;
            (async () => {
                const html = await generatePrintableReportHtml(data, type);

                // Araç modülündeki gibi Blob URL kullan (doğru çalışan yöntem)
                const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                url = URL.createObjectURL(blob);
                setBlobUrl(url);
            })();

            // Cleanup function - URL'i temizle
            return () => {
                if (url) {
                    URL.revokeObjectURL(url);
                }
            };
        }
    }, [data, type]);

    const handleIframeLoad = () => {
        if (window.location.search.includes('autoprint=true') && iframeRef.current) {
            setTimeout(() => {
                if (iframeRef.current && iframeRef.current.contentWindow) {
                    iframeRef.current.contentWindow.print();
                }
            }, 500);
        }
    };

    // Ctrl+P veya Cmd+P tuşlarına basıldığında iframe içeriğini print et
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl+P (Windows/Linux) veya Cmd+P (Mac)
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                e.stopPropagation();

                if (iframeRef.current && iframeRef.current.contentWindow) {
                    iframeRef.current.contentWindow.print();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-gray-100">
                <div className="text-center">
                    <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                    <p className="mt-4 text-lg font-semibold text-gray-700">Rapor Oluşturuluyor...</p>
                    <p className="text-sm text-gray-500">Lütfen bekleyin, verileriniz hazırlanıyor.</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-red-50">
                <div className="text-center p-8 bg-white rounded-lg shadow-xl">
                    <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
                    <h1 className="mt-4 text-2xl font-bold text-red-800">Rapor Oluşturulamadı</h1>
                    <p className="mt-2 text-sm text-red-600">{error}</p>
                    <Button onClick={fetchData} className="mt-6">Tekrar Dene</Button>
                </div>
            </div>
        );
    }

    if (!blobUrl && !loading) {
        return null;
    }

    return (
        <>
            <Helmet>
                <title>{reportTitle || 'Kademe A.Ş. Kalite Yönetim Sistemi'}</title>
            </Helmet>
            <iframe
                ref={iframeRef}
                src={blobUrl || undefined}
                style={{
                    width: '100vw',
                    height: '100vh',
                    border: 'none',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    zIndex: 9999,
                    background: 'white',
                    print: 'auto'
                }}
                title="Printable Report"
                onLoad={handleIframeLoad}
            />
        </>
    );
};

export default PrintableReport;
