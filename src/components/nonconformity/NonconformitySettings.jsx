import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Settings2, AlertTriangle, FileText, Shield } from 'lucide-react';

const NonconformitySettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    id: null,
    df_threshold: 3,
    eight_d_threshold: 5,
    threshold_period_days: 30,
    df_quantity_threshold: 10,
    eight_d_quantity_threshold: 20,
    auto_suggest: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('nonconformity_settings')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (data) {
      setSettings(data);
    } else if (error && error.code !== 'PGRST116') {
      console.error('Settings fetch error:', error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData = {
        df_threshold: parseInt(settings.df_threshold) || 3,
        eight_d_threshold: parseInt(settings.eight_d_threshold) || 5,
        threshold_period_days: parseInt(settings.threshold_period_days) || 30,
        df_quantity_threshold: parseInt(settings.df_quantity_threshold) || 10,
        eight_d_quantity_threshold: parseInt(settings.eight_d_quantity_threshold) || 20,
        auto_suggest: settings.auto_suggest,
      };

      let result;
      if (settings.id) {
        result = await supabase
          .from('nonconformity_settings')
          .update(updateData)
          .eq('id', settings.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('nonconformity_settings')
          .insert(updateData)
          .select()
          .single();
      }

      if (result.error) {
        toast({ variant: 'destructive', title: 'Hata', description: result.error.message });
      } else {
        setSettings(result.data);
        toast({ title: 'Başarılı', description: 'Ayarlar kaydedildi.' });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Hata', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Settings2 className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle>Eşik Değerleri ve Otomatik Öneri</CardTitle>
              <CardDescription>
                Aynı parça kodunda belirli sayıda uygunsuzluk tekrarlandığında DF veya 8D açılması için eşik değerlerini ayarlayın.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Otomatik Öneri Sistemi</p>
                <p className="text-xs text-muted-foreground">Eşik aşımında otomatik DF/8D önerilsin mi?</p>
              </div>
            </div>
            <Switch
              checked={settings.auto_suggest}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_suggest: checked }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-900/10">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <Label className="text-sm font-semibold text-blue-800 dark:text-blue-300">DF Eşik Değeri</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Aynı parça kodunda bu kadar uygunsuzluk olduğunda Düzeltici Faaliyet (DF) önerilir.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.df_threshold}
                  onChange={(e) => setSettings(prev => ({ ...prev, df_threshold: e.target.value }))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">adet</span>
              </div>
            </div>

            <div className="space-y-3 p-4 rounded-lg border bg-red-50/50 dark:bg-red-900/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <Label className="text-sm font-semibold text-red-800 dark:text-red-300">8D Eşik Değeri</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Aynı parça kodunda bu kadar uygunsuzluk olduğunda 8D önerilir.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.eight_d_threshold}
                  onChange={(e) => setSettings(prev => ({ ...prev, eight_d_threshold: e.target.value }))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">adet</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-900/10">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <Label className="text-sm font-semibold text-blue-800 dark:text-blue-300">Tek Seferlik Adet Eşiği (DF)</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Tek bir kayıtta hatalı adet bu değeri geçerse, tekrar sayısına bakılmaksızın doğrudan DF önerilir.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="10000"
                  value={settings.df_quantity_threshold}
                  onChange={(e) => setSettings(prev => ({ ...prev, df_quantity_threshold: e.target.value }))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">adet</span>
              </div>
            </div>

            <div className="space-y-3 p-4 rounded-lg border bg-red-50/50 dark:bg-red-900/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <Label className="text-sm font-semibold text-red-800 dark:text-red-300">Tek Seferlik Adet Eşiği (8D)</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Tek bir kayıtta hatalı adet bu değeri geçerse, tekrar sayısına bakılmaksızın doğrudan 8D önerilir.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="10000"
                  value={settings.eight_d_quantity_threshold}
                  onChange={(e) => setSettings(prev => ({ ...prev, eight_d_quantity_threshold: e.target.value }))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">adet</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-lg border">
            <Label className="text-sm font-semibold">Değerlendirme Periyodu</Label>
            <p className="text-xs text-muted-foreground">
              Eşik hesaplaması için kaç günlük süre dikkate alınsın?
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="365"
                value={settings.threshold_period_days}
                onChange={(e) => setSettings(prev => ({ ...prev, threshold_period_days: e.target.value }))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">gün</span>
            </div>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                <p className="font-semibold">Nasıl Çalışır?</p>
                <p><strong>Tekrar bazlı:</strong> Bir parça koduna ait uygunsuzluk kayıt sayısı, belirlenen periyot içinde DF eşiğini geçtiğinde <strong>DF</strong>, 8D eşiğini geçtiğinde <strong>8D</strong> açılması önerilir.</p>
                <p><strong>Adet bazlı:</strong> Tek bir uygunsuzluk kaydındaki hatalı adet, belirlenen DF adet eşiğini geçerse <strong>DF</strong>, 8D adet eşiğini geçerse <strong>8D</strong> açılması önerilir.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NonconformitySettings;
