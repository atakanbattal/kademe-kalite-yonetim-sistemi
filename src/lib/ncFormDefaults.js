/** NC form paylaşılan sabitler — NCFormContext ↔ useNCForm döngüsünü önlemek için ayrı dosya. */

/** Personel ayarındaki üst departman/müdürlük; boşsa birim (department) yedeklenir. */
export const ncOrganizationalUnitFromPersonnel = (p) => {
    if (!p) return '';
    const md = typeof p.management_department === 'string' ? p.management_department.trim() : '';
    if (md) return md;
    const dept = typeof p.department === 'string' ? p.department.trim() : '';
    return dept || '';
};

export const defaultEightDSteps = {
    D1: { title: 'Ekip Oluşturma', responsible: '', completionDate: '', description: '' },
    D2: { title: 'Problemi Tanımlama', responsible: '', completionDate: '', description: '' },
    D3: { title: 'Geçici Önlemler Alma', responsible: '', completionDate: '', description: '' },
    D4: { title: 'Kök Neden Analizi', responsible: '', completionDate: '', description: '' },
    D5: { title: 'Kalıcı Düzeltici Faaliyetleri Belirleme', responsible: '', completionDate: '', description: '' },
    D6: { title: 'Kalıcı Düzeltici Faaliyetleri Uygulama', responsible: '', completionDate: '', description: '' },
    D7: { title: 'Tekrarlanmayı Önleme', responsible: '', completionDate: '', description: '' },
    D8: { title: 'Ekibi Takdir Etme', responsible: '', completionDate: '', description: '' },
};
