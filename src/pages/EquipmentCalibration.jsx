import React from 'react';
import { Helmet } from 'react-helmet';
import EquipmentModule from '@/components/equipment/EquipmentModule';

const EquipmentCalibrationPage = () => {
  return (
    <>
      <Helmet>
        <title>Ekipman ve Kalibrasyon - Kademe Kalite Yönetimi</title>
        <meta name="description" content="Ölçüm cihazları ve ekipmanların kalibrasyon yönetimi, zimmet takibi." />
        <meta property="og:title" content="Ekipman ve Kalibrasyon - Kademe Kalite Yönetimi" />
        <meta property="og:description" content="Ölçüm cihazları ve ekipmanların kalibrasyon yönetimi, zimmet takibi." />
      </Helmet>
      <EquipmentModule />
    </>
  );
};

export default EquipmentCalibrationPage;