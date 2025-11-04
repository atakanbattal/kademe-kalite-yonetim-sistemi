import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Award, AlertCircle, TrendingUp, Info, 
    CheckCircle, XCircle, Clock, Target
} from 'lucide-react';
import { 
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import PersonnelSkillModal from './PersonnelSkillModal';

// Seviye renk ve açıklamaları
const SKILL_LEVELS = {
    0: { 
        label: 'Bilgi Yok', 
        color: 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400', 
        description: 'Eğitim almamış / Bilgi yok'
    },
    1: { 
        label: 'Temel', 
        color: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400', 
        description: 'Temel bilgi sahibi / Gözlemci'
    },
    2: { 
        label: 'Gözetimli', 
        color: 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400', 
        description: 'Gözetim altında çalışabilir'
    },
    3: { 
        label: 'Bağımsız', 
        color: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400', 
        description: 'Bağımsız çalışabilir'
    },
    4: { 
        label: 'Eğitmen', 
        color: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400', 
        description: 'Eğitmen / Mentor seviyesi'
    }
};

const PolyvalenceMatrix = ({ personnel, skills, personnelSkills, skillCategories, onRefresh }) => {
    const { toast } = useToast();
    const [selectedCell, setSelectedCell] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Create a map for quick skill lookup
    const skillMap = useMemo(() => {
        const map = {};
        personnelSkills.forEach(ps => {
            const key = `${ps.personnel_id}-${ps.skill_id}`;
            map[key] = ps;
        });
        return map;
    }, [personnelSkills]);

    // Get skill data for a person
    const getPersonnelSkill = (personnelId, skillId) => {
        const key = `${personnelId}-${skillId}`;
        return skillMap[key] || null;
    };

    // Calculate polyvalence score for a person
    const calculatePolyvalenceScore = (personnelId) => {
        const personSkills = personnelSkills.filter(ps => ps.personnel_id === personnelId);
        if (personSkills.length === 0) return 0;
        
        const proficientSkills = personSkills.filter(ps => ps.current_level >= 3).length;
        return Math.round((proficientSkills / skills.length) * 100);
    };

    // Handle cell click
    const handleCellClick = (person, skill) => {
        const existingSkill = getPersonnelSkill(person.id, skill.id);
        setSelectedCell({
            person,
            skill,
            personnelSkill: existingSkill
        });
        setIsModalOpen(true);
    };

    // Group skills by category
    const skillsByCategory = useMemo(() => {
        const grouped = {};
        skills.forEach(skill => {
            const categoryName = skill.category?.name || 'Diğer';
            if (!grouped[categoryName]) {
                grouped[categoryName] = [];
            }
            grouped[categoryName].push(skill);
        });
        return grouped;
    }, [skills]);

    if (personnel.length === 0 || skills.length === 0) {
        return (
            <Card>
                <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                        <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">Polivalans matrisi oluşturulamıyor</p>
                        <p className="text-sm mt-2">Lütfen önce personel ve yetkinlik tanımlarını ekleyin.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Yetkinlik Matrisi</CardTitle>
                        <div className="flex items-center gap-2 text-sm">
                            {Object.entries(SKILL_LEVELS).map(([level, config]) => (
                                <TooltipProvider key={level}>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Badge variant="outline" className={config.color}>
                                                Seviye {level}: {config.label}
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{config.description}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-auto w-full h-[calc(100vh-400px)] border rounded-md">
                        <table className="w-full border-collapse min-w-max">
                                <thead>
                                    <tr className="bg-muted">
                                        <th className="sticky left-0 z-30 bg-background p-3 text-left font-semibold min-w-[200px] border-r border-b shadow-sm">
                                            Personel / Yetkinlik
                                        </th>
                                        {Object.entries(skillsByCategory).map(([categoryName, categorySkills]) => (
                                            <React.Fragment key={categoryName}>
                                                <th 
                                                    colSpan={categorySkills.length}
                                                    className="p-3 text-center font-semibold border-r border-b bg-primary/10"
                                                >
                                                    {categoryName}
                                                </th>
                                            </React.Fragment>
                                        ))}
                                        <th className="p-3 text-center font-semibold border-b min-w-[100px] bg-blue-50 dark:bg-blue-950">
                                            Polivalans
                                        </th>
                                    </tr>
                                    <tr className="bg-muted/50">
                                        <th className="sticky left-0 z-30 bg-background p-2 border-r border-b shadow-sm"></th>
                                        {skills.map(skill => (
                                            <th 
                                                key={skill.id}
                                                className="p-2 text-xs border-r border-b min-w-[80px] max-w-[100px]"
                                            >
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger className="cursor-help">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className="font-medium truncate w-full">{skill.code || skill.name}</span>
                                                                {skill.requires_certification && (
                                                                    <Award className="h-3 w-3 text-purple-500" />
                                                                )}
                                                                {skill.is_critical && (
                                                                    <AlertCircle className="h-3 w-3 text-red-500" />
                                                                )}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <div className="space-y-1">
                                                                <p className="font-semibold">{skill.name}</p>
                                                                {skill.description && (
                                                                    <p className="text-xs text-muted-foreground">{skill.description}</p>
                                                                )}
                                                                {skill.requires_certification && (
                                                                    <p className="text-xs text-purple-600">Sertifika gerekli</p>
                                                                )}
                                                                {skill.is_critical && (
                                                                    <p className="text-xs text-red-600">Kritik yetkinlik</p>
                                                                )}
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </th>
                                        ))}
                                        <th className="p-2 text-xs border-b bg-blue-50 dark:bg-blue-950">
                                            Skor
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {personnel.map((person, personIndex) => {
                                        const polyvalenceScore = calculatePolyvalenceScore(person.id);
                                        
                                        return (
                                            <motion.tr
                                                key={person.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: personIndex * 0.02 }}
                                                className="hover:bg-muted/30 transition-colors"
                                            >
                                                <td className="sticky left-0 z-20 bg-background p-3 border-r border-b font-medium shadow-sm">
                                                    <div>
                                                        <div className="font-semibold">{person.full_name}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {person.department} {person.position && `• ${person.position}`}
                                                        </div>
                                                    </div>
                                                </td>
                                                {skills.map(skill => {
                                                    const personnelSkill = getPersonnelSkill(person.id, skill.id);
                                                    const level = personnelSkill?.current_level || 0;
                                                    const levelConfig = SKILL_LEVELS[level];
                                                    const isCertified = personnelSkill?.is_certified;
                                                    const needsTraining = personnelSkill?.training_required;

                                                    return (
                                                        <td 
                                                            key={skill.id}
                                                            className="p-1 border-r border-b text-center cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                                            onClick={() => handleCellClick(person, skill)}
                                                        >
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full">
                                                                        <div className={`rounded p-2 ${levelConfig.color} flex flex-col items-center justify-center gap-1 min-h-[50px]`}>
                                                                            <span className="font-bold text-xl">{level}</span>
                                                                            <div className="flex items-center gap-1">
                                                                                {isCertified && (
                                                                                    <Award className="h-3 w-3" />
                                                                                )}
                                                                                {needsTraining && (
                                                                                    <AlertCircle className="h-3 w-3 text-orange-500" />
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <div className="space-y-1">
                                                                            <p className="font-semibold">Seviye {level}: {levelConfig.label}</p>
                                                                            {personnelSkill && (
                                                                                <>
                                                                                    {isCertified && (
                                                                                        <p className="text-xs text-green-600 flex items-center gap-1">
                                                                                            <CheckCircle className="h-3 w-3" /> Sertifikalı
                                                                                        </p>
                                                                                    )}
                                                                                    {needsTraining && (
                                                                                        <p className="text-xs text-orange-600 flex items-center gap-1">
                                                                                            <TrendingUp className="h-3 w-3" /> Eğitim gerekli
                                                                                        </p>
                                                                                    )}
                                                                                    {personnelSkill.target_level && (
                                                                                        <p className="text-xs text-blue-600 flex items-center gap-1">
                                                                                            <Target className="h-3 w-3" /> Hedef: {personnelSkill.target_level}
                                                                                        </p>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                            <p className="text-xs text-muted-foreground mt-2">
                                                                                Detay için tıklayın
                                                                            </p>
                                                                        </div>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </td>
                                                    );
                                                })}
                                                <td className="p-2 border-b text-center bg-blue-50 dark:bg-blue-950">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-xl font-bold text-blue-600">
                                                            {polyvalenceScore}%
                                                        </span>
                                                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                                                            <div 
                                                                className="bg-blue-600 h-2 rounded-full transition-all"
                                                                style={{ width: `${polyvalenceScore}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                    </div>
                </CardContent>
            </Card>

            {/* Personnel Skill Modal */}
            {selectedCell && (
                <PersonnelSkillModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedCell(null);
                    }}
                    person={selectedCell.person}
                    skill={selectedCell.skill}
                    personnelSkill={selectedCell.personnelSkill}
                    onRefresh={onRefresh}
                />
            )}
        </>
    );
};

export default PolyvalenceMatrix;

