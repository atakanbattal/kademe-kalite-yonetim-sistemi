import React from 'react';
import { Helmet } from 'react-helmet';
import DeviationModule from '@/components/deviation/DeviationModule';

const DeviationManagementPage = () => {
  return (
    <>
      <Helmet>
        <title>Sapma Yönetimi - Kademe Kalite</title>
        <meta name="description" content="Üretim ve proses sapmalarını yönetin, onaylayın ve izleyin." />
      </Helmet>
      <DeviationModule />
    </>
  );
};

export default DeviationManagementPage;