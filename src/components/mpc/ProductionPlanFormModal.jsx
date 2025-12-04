import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const PLAN_PERIODS = ['Daily', 'Weekly', 'Monthly'];
const PLAN_STATUSES = ['Planned', 'In Progress', 'Completed', 'Cancelled'];

const ProductionPlanFormModal = ({ open, setOpen, existingPlan, onSuccess }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        plan_number: '',
        plan_name: '',
        plan_date: new Date().toISOString().split('T')[0],
        plan_period: 'Daily',
        part_number: '',
        part_name: '',
        planned_quantity: '',
        actual_quantity: '',
        status: 'Planned'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingPlan) {
            setFormData({
                ...existingPlan,
                plan_date: existingPlan.plan_date || new Date().toISOString().split('T')[0],
                planned_quantity: existingPlan.planned_quantity?.toString() || '',
                actual_quantity: existingPlan.actual_quantity?.toString() || ''
            });
        } else {
            const year = new Date().getFullYear();
            const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            setFormData({
                plan_number: `PLAN-${year}-${randomNum}`,
                plan_name: '',
                plan_date: new Date().toISOString().split('T')[0],
                plan_period: 'Daily',
                part_number: '',
                part_name: '',
                planned_quantity: '',
                actual_quantity: '',
                status: 'Planned'
            });
        }
    }, [existingPlan, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const plannedQty = parseInt(formData.planned_quantity) || 0;
            const actualQty = parseInt(formData.actual_quantity) || 0;
            const efficiency = plannedQty > 0 ? (actualQty / plannedQty * 100) : 0;

            const dataToSubmit = {
                ...formData,
                planned_quantity: plannedQty,
                actual_quantity: actualQty,
                efficiency_percentage: efficiency
            };

            if (existingPlan) {
                const { error } = await supabase
                    .from('production_plans')
                    .update(dataToSubmit)
                    .eq('id', existingPlan.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Üretim planı güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('production_plans')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Üretim planı oluşturuldu.'
                });
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving plan:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Plan kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {existingPlan ? 'Üretim Planı Düzenle' : 'Yeni Üretim Planı'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="plan_number">Plan Numarası *</Label>
                                <Input
                                    id="plan_number"
                                    value={formData.plan_number}
                                    onChange={(e) => setFormData({ ...formData, plan_number: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="plan_name">Plan Adı *</Label>
                                <Input
                                    id="plan_name"
                                    value={formData.plan_name}
                                    onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="plan_date">Plan Tarihi *</Label>
                                <Input
                                    id="plan_date"
                                    type="date"
                                    value={formData.plan_date}
                                    onChange={(e) => setFormData({ ...formData, plan_date: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="plan_period">Plan Periyodu</Label>
                                <Select
                                    value={formData.plan_period}
                                    onValueChange={(v) => setFormData({ ...formData, plan_period: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PLAN_PERIODS.map(period => (
                                            <SelectItem key={period} value={period}>{period}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="part_number">Parça Numarası</Label>
                                <Input
                                    id="part_number"
                                    value={formData.part_number}
                                    onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="part_name">Parça Adı</Label>
                                <Input
                                    id="part_name"
                                    value={formData.part_name}
                                    onChange={(e) => setFormData({ ...formData, part_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="planned_quantity">Planlanan Miktar *</Label>
                                <Input
                                    id="planned_quantity"
                                    type="number"
                                    value={formData.planned_quantity}
                                    onChange={(e) => setFormData({ ...formData, planned_quantity: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="actual_quantity">Gerçekleşen Miktar</Label>
                                <Input
                                    id="actual_quantity"
                                    type="number"
                                    value={formData.actual_quantity}
                                    onChange={(e) => setFormData({ ...formData, actual_quantity: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="status">Durum *</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PLAN_STATUSES.map(status => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.planned_quantity && formData.actual_quantity && (
                                <div className="p-3 bg-blue-50 rounded-lg">
                                    <Label className="text-blue-800">Hesaplanan Verimlilik</Label>
                                    <p className="text-lg font-bold text-blue-700">
                                        {((parseFloat(formData.actual_quantity) / parseFloat(formData.planned_quantity)) * 100).toFixed(1)}%
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ProductionPlanFormModal;

