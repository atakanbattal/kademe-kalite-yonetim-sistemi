import React from 'react';
import Df8dManagement from '@/pages/Df8dManagement';

const DFAnd8DModule = ({ initialModalState, onModalClose, onOpenNCView }) => {
  return (
    <Df8dManagement 
        initialModalState={initialModalState} 
        onModalClose={onModalClose}
        onOpenNCView={onOpenNCView}
    />
  );
};

export default DFAnd8DModule;