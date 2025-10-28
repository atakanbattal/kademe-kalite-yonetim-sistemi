import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const KADEME_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAACE4AAAhOAHaInZ3AAAD7UlEQVR4nO2Y3WuTUBCG8y0IIigoiCAiiCAi+IEiioigoigq4v+gIlL8ugKKH1gUv/AH+IWi+IGi+AF+Xam1SZPJOSdnMukkJm1Sm3ZrWjrDcDM5O/NmJvvmzJnd7u/v39Hs7+/f0ezu7t7R7O3t3dHs7u7e0ezu7t7R7O7u3tHs7e3d0ezt7d3R7O/v39Hs7+/f0RyPx3c0x+PxHc3JZHJHczKZ3NEcjUZ3NCeTyR3N8Xh8R3M2m93RnM/ndzTn8/kdzfV6fUdzs9nc0dwulwAqKytQW1uLu7s7HBwcoKGhAS0tLWhuboZer0d9fT3q6+tRV1eHuro61NbWora2FlqtFiqVCiqVCkqlEkqlEiqVCkqlEkqlEkqlUr74+HiSRqNBc3Mz7u7u8Pj4iIeHB9zf3+P+/h4PDw94fHzE4+MjHh8f8fT0hKenJzw+PuLx8REvLy94eXnBy8sLnp+f8fz8jJeXF1xcXODy8hIXFxe4vr7G9fU1bm5ucHt7i9vbW9zc3OD29ha3t7e4ubkBzxQKhfoKcEMpY5zxvDAIEwsLC3h8fMTT0xOenp5wfX2N29tb3N3d4e7uDn7//wY+QZGJZDKJi4sLnJ2d4fT0FKenp/j4+MDn5yc+Pz9xeXmJy8tLXF1d4erqClf/LK6urrC4uIiFhQUsLS3h8vISl5eXuLi4wOXlJc7Pz3F+fo6zszOcnZ3h7OwM5+fn+PH5+YnP3+z8/Bzn5+dYXV3F6uoqVldXsbq6ivX1dWxsbGBjYwOrq6tYXV3F2toaVldXsbm5ia2tLWxtbWF7exvb29vY3t7G9vY2VlZWsLKygtXVVWxsbGBzc1Pb2dmh7e1tWl5exvLyMpaXl7G8vIzl5WUsLS1haWkJS0tLWFpawuLiIi4uLnB1dYWrqyup5HI53t/f6d3dnd7d3end3Z3e39/r/f09fXh4oC8vL/T19ZXe3t7S29tbenNzQ29vb2l3d1e7u7u0ubmpW1tb2tramm5sbNDGxgZtbGxQT08P9fT0UHd3N3V3d1N3dzd1dXVRV1cXdXV1UWdnJ3V2dlJnZyd1dHRQR0cHvb+/0+vrK7++vv6bm1VVVdHX11fe39/p8/Ozvry80JeXF3p9faXX11d6eXmht7c3ent7o3d3d3R3d0f39/f04eGBHh4e6PHxUR4eHuT19ZXe3Nzoy8sLvb6+0tPTE729vdHr6yu9vr7S29ubXF9f0+PjI3l+fkonJyd0eHhIv7+/Fmzx+Pz8pD8/P/T391dO3t/fKZfLkU6no5yc/Pz8yI/P5/Px8RFyAnx+fl7o6+vLCq8K/PX1ZYVWBf7+/raC/QAh0VUNWUCwVAAAAABJRU5ErkJggg==';

const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return '₺0,00';
    return '₺' + value.toLocaleString('tr-TR', { 
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
        return format(new Date(dateStr), 'dd MMMM yyyy', { locale: tr });
    } catch {
        return '-';
    }
};

export const generateIncomingInspectionPDF = (inspection) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    // ===== HEADER / BAŞLIK =====
    const headerHeight = 35;
    doc.setFillColor(25, 35, 71); // Dark blue
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    // Logo placeholder (şirket logosu yerine metin)
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text('KADEME', margin, yPosition + 12, { maxWidth: 40 });

    // Başlık
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('GİRDİ KALİTE KONTROL RAPORU', pageWidth / 2, yPosition + 12, { 
        align: 'center', 
        maxWidth: pageWidth - 2 * margin 
    });

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text(
        `Kalite Yönetim Sistemi • Giriş Muayenesi • ${formatDate(new Date())}`,
        pageWidth / 2,
        yPosition + 20,
        { align: 'center' }
    );

    yPosition += headerHeight + 10;

    // ===== KAYıT BİLGİLERİ =====
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('MUAYENE KAYREGI BİLGİLERİ', margin, yPosition);
    yPosition += 8;

    const recordInfoData = [
        ['Kayıt No', inspection.record_no || '-', 'Muayene Tarihi', formatDate(inspection.inspection_date)],
        ['Tedarikçi', inspection.supplier_name || '-', 'Teslimat Belgesi', inspection.delivery_note_number || '-'],
    ];

    doc.setFontSize(9);
    recordInfoData.forEach(row => {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(row[0], margin, yPosition);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(String(row[1]), margin + 35, yPosition);

        doc.setFont(undefined, 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(row[2], margin + 95, yPosition);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(String(row[3]), margin + 130, yPosition);

        yPosition += 7;
    });

    yPosition += 5;

    // ===== PARÇA BİLGİLERİ =====
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('PARÇA BİLGİLERİ', margin, yPosition);
    yPosition += 8;

    const partInfoData = [
        ['Parça Adı', inspection.part_name || '-', 'Birim', inspection.unit || 'Adet'],
        ['Parça Kodu', inspection.part_code || '-', 'Gelen Miktar', String(inspection.quantity_received || 0)],
    ];

    doc.setFontSize(9);
    partInfoData.forEach(row => {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(row[0], margin, yPosition);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(String(row[1]), margin + 35, yPosition);

        doc.setFont(undefined, 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(row[2], margin + 95, yPosition);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(String(row[3]), margin + 130, yPosition);

        yPosition += 7;
    });

    yPosition += 5;

    // ===== MUAYENE SONUÇLARI =====
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('MUAYENE SONUÇLARI', margin, yPosition);
    yPosition += 8;

    const resultsData = [
        ['Kabul Edilen', String(inspection.quantity_accepted || 0), 'Şartlı Kabul', String(inspection.quantity_conditional || 0)],
        ['Reddedilen', String(inspection.quantity_rejected || 0), 'Karar', inspection.decision || 'Beklemede'],
    ];

    doc.setFontSize(9);
    resultsData.forEach(row => {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(row[0], margin, yPosition);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(String(row[1]), margin + 35, yPosition);

        doc.setFont(undefined, 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(row[2], margin + 95, yPosition);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(String(row[3]), margin + 130, yPosition);

        yPosition += 7;
    });

    yPosition += 10;

    // ===== KUSURLAR (Defects) =====
    if (inspection.defects && inspection.defects.length > 0) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('TESPİT EDİLEN KUSURLAR', margin, yPosition);
        yPosition += 8;

        doc.setFontSize(9);
        inspection.defects.forEach((defect, idx) => {
            doc.setFont(undefined, 'bold');
            doc.setTextColor(200, 30, 30);
            doc.text(`${idx + 1}. ${defect.defect_type || '-'}`, margin, yPosition);
            yPosition += 5;

            doc.setFont(undefined, 'normal');
            doc.setTextColor(60, 60, 60);
            const descLines = doc.splitTextToSize(defect.description || '-', pageWidth - 2 * margin - 5);
            doc.text(descLines, margin + 5, yPosition);
            yPosition += (descLines.length * 5) + 3;

            if (yPosition > pageHeight - 50) {
                doc.addPage();
                yPosition = margin;
            }
        });

        yPosition += 5;
    }

    // ===== MUAYENE DETAYLARı (Results) =====
    if (inspection.results && inspection.results.length > 0) {
        if (yPosition > pageHeight - 80) {
            doc.addPage();
            yPosition = margin;
        }

        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('MUAYENE ÖZELLİKLERİ VE SONUÇLARI', margin, yPosition);
        yPosition += 8;

        const tableData = inspection.results.map(result => [
            result.characteristic_name || '-',
            result.measurement_method || '-',
            result.nominal_value || '-',
            result.min_value ? `${result.min_value}` : '-',
            result.max_value ? `${result.max_value}` : '-',
            result.measured_value || '-',
            result.result ? 'OK ✓' : 'NOK ✗'
        ]);

        doc.autoTable({
            head: [['Özellik', 'Yöntem', 'Nominal', 'Min', 'Mak', 'Ölçülen', 'Sonuç']],
            body: tableData,
            startY: yPosition,
            margin: margin,
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 25 },
                2: { cellWidth: 18 },
                3: { cellWidth: 15 },
                4: { cellWidth: 15 },
                5: { cellWidth: 18 },
                6: { cellWidth: 18, halign: 'center' }
            },
            headStyles: {
                fillColor: [25, 35, 71],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9,
                cellPadding: 4
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: 3,
                textColor: [60, 60, 60]
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            didDrawPage: (data) => {
                yPosition = data.cursor.y + 5;
            }
        });

        yPosition += 10;
    }

    // ===== İMZA ALANI =====
    if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = margin;
    }

    yPosition = pageHeight - 50;

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);

    // Hazırlayan
    doc.text('Hazırlayan:', margin, yPosition);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition + 15, margin + 50, yPosition + 15);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(inspection.prepared_by || '........................', margin, yPosition + 18);

    // Oluşturan
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Oluşturan:', pageWidth / 2, yPosition);
    doc.setLineWidth(0.5);
    doc.line(pageWidth / 2, yPosition + 15, pageWidth / 2 + 50, yPosition + 15);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(inspection.created_by || '........................', pageWidth / 2, yPosition + 18);

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
        `Oluşturma Tarihi: ${formatDate(new Date())} • Belge No: GKK-${inspection.record_no || 'XXXX'}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
    );

    // PDF'i indir
    const fileName = `GKK_Raporu_${inspection.record_no || 'rapor'}_${format(new Date(), 'ddMMyyyy')}.pdf`;
    doc.save(fileName);
};

export default generateIncomingInspectionPDF;
