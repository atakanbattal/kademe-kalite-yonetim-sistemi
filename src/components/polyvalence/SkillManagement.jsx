import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Award, AlertCircle, FolderPlus, Edit2 } from 'lucide-react';
import SkillFormModal from './SkillFormModal';
import CategoryFormModal from './CategoryFormModal';

const SkillManagement = ({ skills, skillCategories, onRefresh }) => {
    const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
    const [editingSkill, setEditingSkill] = useState(null);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);

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
                onRefresh={onRefresh}
            />

            <CategoryFormModal
                isOpen={isCategoryModalOpen}
                onClose={() => {
                    setIsCategoryModalOpen(false);
                    setEditingCategory(null);
                }}
                category={editingCategory}
                onRefresh={onRefresh}
            />
        </div>
    );
};

export default SkillManagement;

