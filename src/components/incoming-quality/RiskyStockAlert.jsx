
    import React from 'react';
    import { AlertTriangle, X, ExternalLink } from 'lucide-react';
    import { Button } from '@/components/ui/button';

    const RiskyStockAlert = ({ data, onViewStock, onClose }) => {
        if (!data?.has_risky_stock) return null;

        return (
            <div className="bg-red-50 border-2 border-red-600 rounded-lg p-4 mb-6 shadow-lg animate-pulse-slow">
                <style>
                {`
                    @keyframes pulse-slow {
                        0%, 100% {
                            opacity: 1;
                        }
                        50% {
                            opacity: 0.95;
                        }
                    }
                    .animate-pulse-slow {
                        animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                    }
                `}
                </style>
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    
                    <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="text-lg font-bold text-red-900">
                                DIKKAT - POTANSIYEL RISKLI STOK KONTROLU GEREKLI!
                            </h3>
                            <button 
                                onClick={onClose}
                                className="text-red-600 hover:text-red-800 transition-colors"
                                title="Kapat"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="bg-red-100 rounded-md p-3 mb-3">
                            <p className="text-red-900 font-semibold text-base">
                                Bu parça kodundan ({data.part_code}) daha önce kabul edilmiş{' '}
                                <span className="text-2xl font-bold text-red-700">
                                    {data.total_quantity} adet
                                </span>{' '}
                                stok bulunuyor!
                            </p>
                        </div>
                        
                        <div className="bg-white rounded-md border border-red-200 p-3 mb-3">
                            <p className="text-sm font-semibold text-gray-700 mb-2">
                                Önceki Kabul Edilen Partiler:
                            </p>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {data.inspections.slice(0, 5).map((inspection, index) => (
                                    <div key={inspection.id} className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">
                                                {index + 1}. Kayıt: {inspection.record_no || `#${inspection.id}`}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {new Date(inspection.inspection_date).toLocaleDateString('tr-TR')}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-600 mt-1">
                                            Miktar: <span className="font-semibold">{inspection.quantity_accepted} adet</span>
                                            {inspection.supplier && (
                                                <span className="ml-2">• Tedarikçi: {inspection.supplier.name || 'Bilinmeyen'}</span>
                                            )}
                                             {inspection.delivery_note_number && (
                                                <span className="ml-2">• İrsaliye: {inspection.delivery_note_number}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {data.inspections.length > 5 && (
                                <p className="text-xs text-gray-500 mt-2 text-center">
                                    ... ve {data.inspections.length - 5} kayıt daha
                                </p>
                            )}
                        </div>
                        
                        <div className="bg-yellow-50 border border-yellow-300 rounded-md p-3 mb-3">
                            <p className="text-sm text-yellow-800 font-medium leading-relaxed">
                                ÖNLEM: Bu stoklar da aynı sorunu taşıyor olabilir!
                                <br/>
                                Lütfen bu partileri acilen yeniden kontrol edin ve gerekirse karantinaya alın.
                            </p>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                onClick={onViewStock}
                                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 transition-colors font-medium"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Stok Kontrolü Başlat
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                className="px-4 py-2.5"
                            >
                                Daha Sonra
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    export default RiskyStockAlert;
  