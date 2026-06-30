import React from 'react';

const DOC_URL = '/docs/Kademe_Birim_Surec_Akis_Semalari.html';

const ProcessFlowDiagramsModule = () => (
    <div className="-m-3 sm:-m-4 md:-m-6 h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-4rem)]">
        <iframe
            src={DOC_URL}
            title="Süreç Akış Şemaları"
            className="h-full w-full border-0 bg-white"
        />
    </div>
);

export default ProcessFlowDiagramsModule;
