import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Award, AlertCircle, FolderPlus, Edit2, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import SkillFormModal from './SkillFormModal';
import CategoryFormModal from './CategoryFormModal';

const SkillManagement = ({ skills, skillCategories, onRefresh, departments = [] }) => {
    const { toast } = useToast();
    const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
    const [editingSkill, setEditingSkill] = useState(null);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);

    const handleDeleteSkill = async (skillId, skillName) => {
        try {
            const { error } = await supabase
                .from('skills')
                .delete()
                .eq('id', skillId);

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: `"${skillName}" yetkinliği başarıyla silindi.`
            });
            onRefresh();
        } catch (error) {
            console.error('Yetkinlik silme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Yetkinlik silinemedi: ' + error.message
            });
        }
    };

    const handleDeleteCategory = async (categoryId, categoryName) => {
        try {
            // Check if category has skills
            const categorySkills = skills.filter(s => s.category_id === categoryId);
            if (categorySkills.length > 0) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: `Bu kategoride ${categorySkills.length} yetkinlik bulunmaktadır. Önce yetkinlikleri silin veya başka bir kategoriye taşıyın.`
                });
                return;
            }

            const { error } = await supabase
                .from('skill_categories')
                .delete()
                .eq('id', categoryId);

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: `"${categoryName}" kategorisi başarıyla silindi.`
            });
            onRefresh();
        } catch (error) {
            console.error('Kategori silme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Kategori silinemedi: ' + error.message
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Yetkinlik Tanımları</h3>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsCategoryModalOpen(true)}>
                        <FolderPlus className="mr-2 h-4 w-4" />
                        Yeni Kategori
                    </Button>
                    <Button onClick={() => setIsSkillModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Yeni Yetkinlik
                    </Button>
                </div>
            </div>

            {skillCategories.map(category => {
                const categorySkills = skills.filter(s => s.category_id === category.id);

                return (
                    <Card key={category.id}>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div 
                                        className="w-4 h-4 rounded"
                                        style={{ backgroundColor: category.color }}
                                    />
                                    {category.name}
                                    <Badge variant="secondary">{categorySkills.length} yetkinlik</Badge>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setEditingCategory(category);
                                            setIsCategoryModalOpen(true);
                                        }}
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Kategoriyi Sil</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    "{category.name}" kategorisini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => handleDeleteCategory(category.id, category.name)}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    Sil
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {categorySkills.map(skill => (
                                    <div 
                                        key={skill.id}
                                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="font-medium flex items-center gap-2">
                                                {skill.name}
                                                {skill.requires_certification && (
                                                    <Award className="h-4 w-4 text-purple-500" />
                                                )}
                                                {skill.is_critical && (
                                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                                )}
                                            </div>
                                            {skill.code && (
                                                <div className="text-sm text-muted-foreground">{skill.code}</div>
                                            )}
                                            {skill.description && (
                                                <div className="text-sm text-muted-foreground mt-1">{skill.description}</div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">
                                                Hedef: {skill.target_level}
                                            </Badge>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setEditingSkill(skill);
                                                    setIsSkillModalOpen(true);
                                                }}
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Yetkinliği Sil</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            "{skill.name}" yetkinliğini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve tüm personel değerlendirmeleri de silinecektir.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDeleteSkill(skill.id, skill.name)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            Sil
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            <SkillFormModal
                isOpen={isSkillModalOpen}
                onClose={() => {
                    setIsSkillModalOpen(false);
                    setEditingSkill(null);
                }}
                skill={editingSkill}
                skillCategories={skillCategories}
                departments={departments}
                onRefresh={onRefresh}
            />

            <CategoryFormModal
                isOpen={isCategoryModalOpen}
                onClose={() => {
                    setIsCategoryModalOpen(false);
                    setEditingCategory(null);
                }}
                category={editingCategory}
                departments={departments}
                onRefresh={onRefresh}
            />
        </div>
    );
};

export default SkillManagement;

