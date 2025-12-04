import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ComparisonAnalysis = () => {
    const [comparisonData, setComparisonData] = useState([
        { name: 'Ocak', 'Tedarikçi A': 120, 'Tedarikçi B': 150, 'Tedarikçi C': 180 },
        { name: 'Şubat', 'Tedarikçi A': 110, 'Tedarikçi B': 140, 'Tedarikçi C': 170 },
        { name: 'Mart', 'Tedarikçi A': 105, 'Tedarikçi B': 135, 'Tedarikçi C': 165 },
    ]);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Karşılaştırma Analizi</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={comparisonData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Tedarikçi A" fill="#8884d8" />
                            <Bar dataKey="Tedarikçi B" fill="#82ca9d" />
                            <Bar dataKey="Tedarikçi C" fill="#ffc658" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
};

export default ComparisonAnalysis;

