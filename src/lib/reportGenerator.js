import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { sanitizeFileName, toCamelCase } from './utils';

const generatePdf = async (doc, { title, reportNo, record, contentSections, dataContext }) => {
    const { personnel, departments } = dataContext;
    const preparedBy = "Atakan BATTAL";
    const creationDate = format(new Date(), 'dd.MM.yyyy', { locale: tr });

    const addHeader = () => {
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40);
        doc.text('KADEME A.Ş.', 20, 20);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text('Kalite Yönetim Sistemi', 20, 26);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(title, doc.internal.pageSize.getWidth() - 20, 20, { align: 'right' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Rapor No: ${reportNo}`, doc.internal.pageSize.getWidth() - 20, 26, { align: 'right' });
    };

    const addFooter = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Sayfa ${i} / ${pageCount}`, doc.internal.pageSize.getWidth() / 2, 287, { align: 'center' });
            doc.text(`Oluşturma Tarihi: ${creationDate}`, 20, 287);
            doc.text(`Hazırlayan: ${preparedBy}`, doc.internal.pageSize.getWidth() - 20, 287, { align: 'right' });
        }
    };

    addHeader();
    let y = 40;

    contentSections.forEach(section => {
        if (y > 250) {
            doc.addPage();
            addHeader();
            y = 40;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 86, 163); // Blue
        doc.text(section.title, 20, y);
        y += 8;

        if (section.type === 'grid') {
            const body = section.data.map(item => [
                { content: item.label, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: (typeof item.value === 'string' ? toCamelCase(item.value) : item.value) || '-' }
            ]);
            doc.autoTable({
                startY: y,
                body: body,
                theme: 'grid',
                styles: { cellPadding: 2, fontSize: 9 },
                columnStyles: { 0: { cellWidth: 50 } },
                didDrawPage: (data) => {
                    addHeader();
                }
            });
            y = doc.autoTable.previous.finalY + 10;
        } else if (section.type === 'text') {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(50);
            const content = typeof section.content === 'string' ? toCamelCase(section.content) : (section.content || '-');
            const text = doc.splitTextToSize(content, 170);
            doc.text(text, 20, y);
            y += (text.length * 5) + 5;
        } else if (section.type === 'table') {
             doc.autoTable({
                startY: y,
                head: [section.head],
                body: section.body,
                theme: 'striped',
                headStyles: { fillColor: [26, 86, 163] },
                didDrawPage: (data) => {
                    addHeader();
                }
            });
            y = doc.autoTable.previous.finalY + 10;
        }
    });

    addFooter();
    const fileName = sanitizeFileName(`${title}-${reportNo}.pdf`);
    doc.save(fileName);
};

const getNCContent = (record, dataContext) => {
    const { personnel, departments } = dataContext;
    const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy') : '-';
    
    const responsiblePerson = personnel.find(p => p.id === record.responsible_personnel_id)?.full_name || record.responsible_person || '-';
    const departmentName = record.department || '-';

    const content = [
        {
            title: 'Genel Bilgiler',
            type: 'grid',
            data: [
                { label: 'Durum', value: record.status },
                { label: 'Öncelik', value: record.priority },
                { label: 'Talep Eden', value: `${record.requesting_person || '-'} / ${record.requesting_unit || '-'}` },
                { label: 'Sorumlu', value: `${responsiblePerson} / ${departmentName}` },
                { label: 'Açılış Tarihi', value: formatDate(record.df_opened_at) },
                { label: 'Termin Tarihi', value: formatDate(record.due_at) },
            ]
        },
        {
            title: 'Problem Tanımı',
            type: 'text',
            content: record.description
        }
    ];

    // Kök Neden Analizleri (sadece veri varsa göster)
    const hasAnalysis = (record.five_why_analysis && Object.values(record.five_why_analysis).some(v => v && v.toString().trim() !== '')) ||
        (record.five_n1k_analysis && Object.values(record.five_n1k_analysis).some(v => v && v.toString().trim() !== '')) ||
        (record.ishikawa_analysis && Object.values(record.ishikawa_analysis).some(v => v && v.toString().trim() !== '')) ||
        (record.fta_analysis && Object.values(record.fta_analysis).some(v => v && v.toString().trim() !== ''));
    
    if (hasAnalysis) {
        const analysisData = [];
        
        // 5N1K Analizi
        if (record.five_n1k_analysis && Object.values(record.five_n1k_analysis).some(v => v && v.toString().trim() !== '')) {
            const analysis = record.five_n1k_analysis;
            if (analysis.what) analysisData.push({ label: '5N1K - Ne', value: analysis.what });
            if (analysis.where) analysisData.push({ label: '5N1K - Nerede', value: analysis.where });
            if (analysis.when) analysisData.push({ label: '5N1K - Ne Zaman', value: analysis.when });
            if (analysis.who) analysisData.push({ label: '5N1K - Kim', value: analysis.who });
            if (analysis.how) analysisData.push({ label: '5N1K - Nasıl', value: analysis.how });
            if (analysis.why) analysisData.push({ label: '5N1K - Neden Önemli', value: analysis.why });
        }
        
        // 5 Neden Analizi
        if (record.five_why_analysis && Object.values(record.five_why_analysis).some(v => v && v.toString().trim() !== '')) {
            const analysis = record.five_why_analysis;
            if (analysis.why1) analysisData.push({ label: '5 Neden - 1. Neden', value: analysis.why1 });
            if (analysis.why2) analysisData.push({ label: '5 Neden - 2. Neden', value: analysis.why2 });
            if (analysis.why3) analysisData.push({ label: '5 Neden - 3. Neden', value: analysis.why3 });
            if (analysis.why4) analysisData.push({ label: '5 Neden - 4. Neden', value: analysis.why4 });
            if (analysis.why5) analysisData.push({ label: '5 Neden - 5. Neden (Kök Neden)', value: analysis.why5 });
            if (analysis.rootCause) analysisData.push({ label: 'Kök Neden Özeti', value: analysis.rootCause });
            if (analysis.immediateAction) analysisData.push({ label: 'Anlık Aksiyon', value: analysis.immediateAction });
            if (analysis.preventiveAction) analysisData.push({ label: 'Önleyici Aksiyon', value: analysis.preventiveAction });
        }
        
        // Ishikawa Analizi
        if (record.ishikawa_analysis && Object.values(record.ishikawa_analysis).some(v => v && v.toString().trim() !== '')) {
            const analysis = record.ishikawa_analysis;
            if (analysis.man) analysisData.push({ label: 'Ishikawa - İnsan', value: analysis.man });
            if (analysis.machine) analysisData.push({ label: 'Ishikawa - Makine', value: analysis.machine });
            if (analysis.method) analysisData.push({ label: 'Ishikawa - Metot', value: analysis.method });
            if (analysis.material) analysisData.push({ label: 'Ishikawa - Malzeme', value: analysis.material });
            if (analysis.environment) analysisData.push({ label: 'Ishikawa - Çevre', value: analysis.environment });
            if (analysis.measurement) analysisData.push({ label: 'Ishikawa - Ölçüm', value: analysis.measurement });
        }
        
        // FTA Analizi
        if (record.fta_analysis && Object.values(record.fta_analysis).some(v => v && v.toString().trim() !== '')) {
            const analysis = record.fta_analysis;
            if (analysis.topEvent) analysisData.push({ label: 'FTA - Üst Olay', value: analysis.topEvent });
            if (analysis.intermediateEvents) analysisData.push({ label: 'FTA - Ara Olaylar', value: analysis.intermediateEvents });
            if (analysis.basicEvents) analysisData.push({ label: 'FTA - Temel Olaylar', value: analysis.basicEvents });
            if (analysis.gates) analysisData.push({ label: 'FTA - Kapılar', value: analysis.gates });
            if (analysis.rootCauses) analysisData.push({ label: 'FTA - Kök Nedenler', value: analysis.rootCauses });
            if (analysis.summary) analysisData.push({ label: 'FTA - Özet', value: analysis.summary });
        }
        
        if (analysisData.length > 0) {
            content.push({
                title: 'Kök Neden Analizi',
                type: 'grid',
                data: analysisData
            });
        }
    }

    if (record.type === '8D' && record.eight_d_steps) {
        content.push({
            title: '8D Adımları',
            type: 'table',
            head: ['Adım', 'Sorumlu', 'Tarih', 'Açıklama'],
            body: Object.entries(record.eight_d_steps).map(([key, step]) => [
                `${key}: ${toCamelCase(step.title || '')}`,
                typeof step.responsible === 'string' ? toCamelCase(step.responsible) : (step.responsible || '-'),
                formatDate(step.completionDate),
                typeof step.description === 'string' ? toCamelCase(step.description) : (step.description || '-')
            ])
        });
    }
    
    if (record.status === 'Kapatıldı') {
        content.push({
            title: 'Kapanış Bilgileri',
            type: 'grid',
            data: [
                { label: 'Kapanış Tarihi', value: formatDate(record.closed_at) },
                { label: 'Kapanış Notları', value: record.closing_notes || '-' }
            ]
        });
    }

    return content;
};

const getKaizenContent = (record, dataContext) => {
    const { personnel, departments } = dataContext;
    const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy') : '-';
    const formatCurrency = (value) => (value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

    const proposer = personnel.find(p => p.id === record.proposer_id)?.full_name || '-';
    const responsible = personnel.find(p => p.id === record.responsible_person_id)?.full_name || '-';
    const department = departments.find(d => d.id === record.department_id)?.unit_name || '-';
    const teamMembers = record.team_members?.map(id => personnel.find(p => p.id === id)?.full_name).filter(Boolean).join(', ') || '-';

    return [
        {
            title: 'Genel Bilgiler',
            type: 'grid',
            data: [
                { label: 'Durum', value: record.status },
                { label: 'Öneri Sahibi', value: proposer },
                { label: 'Sorumlu', value: responsible },
                { label: 'Departman', value: department },
                { label: 'Ekip Üyeleri', value: teamMembers },
            ]
        },
        {
            title: 'Problem ve Çözüm',
            type: 'grid',
            data: [
                { label: 'Problem', value: record.problem_description },
                { label: 'Çözüm', value: record.solution_description },
            ]
        },
        {
            title: 'Kazanımlar',
            type: 'grid',
            data: [
                { label: 'Aylık Kazanç', value: formatCurrency(record.total_monthly_gain) },
                { label: 'Yıllık Kazanç', value: formatCurrency(record.total_yearly_gain) },
                { label: 'İşçilik Tasarrufu (dk/adet)', value: `${record.labor_time_saving_minutes || 0} dk` },
            ]
        }
    ];
};

export const generateAndDownloadPdf = async (record, type, dataContext) => {
    const doc = new jsPDF();
    let config;

    if (type === 'nonconformity') {
        config = {
            title: `${record.type} Raporu`,
            reportNo: record.nc_number || record.mdi_no,
            record,
            contentSections: getNCContent(record, dataContext),
            dataContext
        };
    } else if (type === 'kaizen') {
        config = {
            title: 'Kaizen Raporu',
            reportNo: record.kaizen_no,
            record,
            contentSections: getKaizenContent(record, dataContext),
            dataContext
        };
    } else {
        console.error("Unsupported report type");
        return;
    }

    await generatePdf(doc, config);
};