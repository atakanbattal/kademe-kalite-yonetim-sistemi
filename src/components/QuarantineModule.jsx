import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, MoreHorizontal, AlertOctagon, Trash2, Eye, Edit, GitBranch, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import QuarantineFormModal from '@/components/quarantine/QuarantineFormModal';
import QuarantineDecisionModal from '@/components/quarantine/QuarantineDecisionModal';
import CreateNCFromQuarantineModal from '@/components/quarantine/CreateNCFromQuarantineModal';
import QuarantineViewModal from '@/components/quarantine/QuarantineViewModal';
import { useData } from '@/contexts/DataContext';

const QuarantineModule = ({ onOpenNCForm, onOpenNCView }) => {
  const { toast } = useToast();
  const { quarantineRecords, loading, refreshData } = useData();
  const [records, setRecords] = useState([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDecisionOpen, setIsDecisionOpen] = useState(false);
  const [isCreateNCOpen, setCreateNCOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formMode, setFormMode] = useState('new'); // 'new', 'edit', 'view'

  useEffect(() => {
    let filtered = quarantineRecords.sort((a, b) => new Date(b.quarantine_date) - new Date(a.quarantine_date));
    
    if (searchTerm) {
        const lowercasedFilter = searchTerm.toLowerCase();
        filtered = filtered.filter(record => 
            record.part_code?.toLowerCase().includes(lowercasedFilter) ||
            record.part_name?.toLowerCase().includes(lowercasedFilter) ||
            record.lot_no?.toLowerCase().includes(lowercasedFilter)
        );
    }
    setRecords(filtered);
  }, [searchTerm, quarantineRecords]);
  
  const handleDeleteRecord = async (recordId) => {
    const { error } = await supabase.from('quarantine_records').delete().eq('id', recordId);
    if (error) {
        toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt silinemedi: ${error.message}` });
    } else {
        toast({ title: 'Başarılı!', description: 'Kayıt başarıyla silindi.' });
        refreshData();
    }
  };

  const handleOpenView = (record) => {
    setSelectedRecord(record);
    setIsViewOpen(true);
  };

  const handleOpenEdit = (record) => {
    setSelectedRecord(record);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handleOpenNew = () => {
    setSelectedRecord(null);
    setFormMode('new');
    setIsFormOpen(true);
  };
  
  const handleOpenDecision = (record) => {
    setSelectedRecord(record);
    setIsDecisionOpen(true);
  };
  
  const handleOpenCreateNC = (record) => {
    setSelectedRecord(record);
    setCreateNCOpen(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Karantinada': return 'bg-red-100 text-red-800';
      case 'Yeniden İşlem': return 'bg-blue-100 text-blue-800';
      case 'Hurda': return 'bg-gray-200 text-gray-800';
      case 'Onay Bekliyor': return 'bg-yellow-100 text-yellow-800';
      case 'İade': return 'bg-orange-100 text-orange-800';
      case 'Serbest Bırakıldı': return 'bg-green-100 text-green-800';
      case 'Sapma Onaylı': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleOpenNC = (nc) => {
    if(nc && onOpenNCView) {
        onOpenNCView(nc);
    }
  };

  return (
    <div className="space-y-6">
      <QuarantineFormModal isOpen={isFormOpen} setIsOpen={setIsFormOpen} existingRecord={selectedRecord} refreshData={refreshData} mode={formMode} />
      <QuarantineDecisionModal isOpen={isDecisionOpen} setIsOpen={setIsDecisionOpen} record={selectedRecord} refreshData={refreshData} />
      <QuarantineViewModal isOpen={isViewOpen} setIsOpen={setIsViewOpen} record={selectedRecord} />
      {selectedRecord && (
        <CreateNCFromQuarantineModal 
            isOpen={isCreateNCOpen}
            setIsOpen={setCreateNCOpen}
            quarantineRecord={selectedRecord}
            onOpenNCForm={onOpenNCForm}
            refreshData={refreshData}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Karantina Yönetimi</h1>
          <p className="text-muted-foreground mt-1">Karantinadaki ürünleri takip edin ve yönetin.</p>
        </div>
        <div className="mt-4 sm:mt-0">
           <Button onClick={handleOpenNew}><Plus className="w-4 h-4 mr-2"/>Yeni Karantina Kaydı</Button>
        </div>
      </div>
      
      <div className="dashboard-widget">
        <div className="flex justify-between items-center mb-4">
            <div className="search-box w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input 
                type="text" 
                placeholder="Parça kodu, adı veya lot no ara..." 
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Parça Kodu/Adı</th>
                <th>Miktar</th>
                <th>Sebep Olan Birim</th>
                <th>Durum</th>
                <th>İlişkili Uygunsuzluk</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="text-center p-8 text-muted-foreground">Yükleniyor...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan="7" className="text-center p-8 text-muted-foreground">Kayıt bulunamadı.</td></tr>
              ) : (
                records.map((item) => (
                  <motion.tr 
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: item.id * 0.05 }}
                  >
                    <td className="text-foreground">{new Date(item.quarantine_date).toLocaleDateString('tr-TR')}</td>
                    <td className="font-medium text-foreground">
                        <div>{item.part_name}</div>
                        <div className="text-xs text-muted-foreground">{item.part_code} / {item.lot_no}</div>
                    </td>
                    <td className="text-foreground">{item.quantity} {item.unit}</td>
                    <td className="text-foreground">{item.source_department || 'Belirtilmemiş'}</td>
                    <td>
                      <span className={`status-indicator ${getStatusColor(item.status)}`}>{item.status}</span>
                    </td>
                    <td>
                      {item.non_conformity ? (
                        <Button variant="link" className="p-0 h-auto" onClick={() => handleOpenNC(item.non_conformity)}>
                          {item.non_conformity.nc_number}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      ) : '-'}
                    </td>
                    <td>
                        <AlertDialog>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                        <span className="sr-only">Menüyü aç</span>
                                        <MoreHorizontal className="h-4 w-4 text-foreground" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleOpenView(item)}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Görüntüle
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenEdit(item)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Düzenle
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenDecision(item)} disabled={item.quantity <= 0}>
                                        <GitBranch className="mr-2 h-4 w-4" />
                                        Karar Ver
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenCreateNC(item)} disabled={!!item.non_conformity}>
                                        <AlertOctagon className="mr-2 h-4 w-4" />
                                        Uygunsuzluk Oluştur
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4"/>
                                            Kaydı Sil
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Bu işlem geri alınamaz. Bu karantina kaydını kalıcı olarak silecektir.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>İptal</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteRecord(item.id)}>Sil</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QuarantineModule;