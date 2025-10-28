import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

const KPICard = ({ kpi, onCardClick }) => {
  const isTargetAchieved = () => {
    if (kpi.target_value === null || kpi.current_value === null) return null;
    const currentValue = parseFloat(kpi.current_value);
    const targetValue = parseFloat(kpi.target_value);

    if (kpi.target_direction === 'decrease') {
      return currentValue <= targetValue;
    }
    return currentValue >= targetValue;
  };

  const status = isTargetAchieved();
  const displayValue = Number.isInteger(kpi.current_value) ? kpi.current_value : parseFloat(kpi.current_value).toFixed(2);
  const displayTarget = Number.isInteger(kpi.target_value) ? kpi.target_value : parseFloat(kpi.target_value).toFixed(2);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      className={`dashboard-widget border-l-4 cursor-pointer hover:shadow-lg transition-shadow ${status === null ? 'border-l-gray-400' : status ? 'border-l-green-500' : 'border-l-red-500'}`}
      onClick={() => onCardClick(kpi)}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{kpi.name}</h3>
          <p className="text-xs text-muted-foreground">{kpi.data_source}</p>
        </div>
        {status !== null && (status ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />)}
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <div>
          <p className="text-3xl font-bold text-foreground">{displayValue}{kpi.unit}</p>
          <p className="text-sm text-muted-foreground">Hedef: {displayTarget}{kpi.unit}</p>
        </div>
        <ArrowRight className="w-5 h-5 text-muted-foreground" />
      </div>
    </motion.div>
  );
};

export default KPICard;