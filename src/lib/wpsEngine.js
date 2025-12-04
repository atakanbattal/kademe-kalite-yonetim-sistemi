const interpolate = (x, x0, x1, y0, y1) => {
    if (x <= x0) return y0;
    if (x >= x1) return y1;
    return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
};

const getPositionModifier = (position) => {
    switch (position) {
        case 'PA': return { amp: 1.0, volt: 1.0, speed: 1.0 }; // Düz
        case 'PB': return { amp: 0.95, volt: 0.95, speed: 0.9 }; // Yatay Köşe
        case 'PC': return { amp: 0.9, volt: 0.9, speed: 0.85 }; // Yatay
        case 'PD': return { amp: 0.85, volt: 0.85, speed: 0.8 }; // Tavan Köşe
        case 'PE': return { amp: 0.8, volt: 0.8, speed: 0.75 }; // Tavan
        case 'PF': return { amp: 0.85, volt: 0.85, speed: 0.8 }; // Aşağıdan Yukarı
        case 'PG': return { amp: 0.9, volt: 0.9, speed: 0.9 }; // Yukarıdan Aşağı
        default: return { amp: 1.0, volt: 1.0, speed: 1.0 };
    }
};

const notesLibrary = {
    general: [
        "Kaynağa başlamadan önce yüzeyi mutlaka temizle; pas, yağ ve boya kalıntısı dikiş kalitesini düşürür.",
        "Her pasodan sonra cürufu ve sıçrantıyı temizle, sonraki pasoya zemin hazırla.",
        "Dikiş sonunda krateri mutlaka doldur; aksi halde çatlak oluşabilir.",
        "Kaynak torcunu daima doğru açıyla (yaklaşık 10–15°) ilerlet.",
        "WPS’teki gaz, tel ve parametre kombinasyonu bir sebeple verilmiştir; keyfi değiştirme.",
        "Her dikiş senin imzan gibidir — dikkatle at."
    ],
    position: {
        PA: [
            "PA (Düz): Havuz kontrolün kolaydır ama ısı birikimi yüksektir; yanma oluğuna dikkat et.",
            "PA (Düz): 'İtme' tekniği ile daha düzgün dolgu elde edersin."
        ],
        PB: [
            "PB (Yatay Köşe): Alt kenarda birikme yapma; biraz yukarı yönlü torch açısı kullan.",
            "PB (Yatay Köşe): Dikişin iki yanına eşit nüfuziyet sağlamak için ilerlemeyi sabit tut."
        ],
        PC: [
            "PC (Yatay): Yerçekimi havuzu aşağı çeker; akımı biraz düşür, ilerlemeyi hafif artır.",
            "PC (Yatay): Torch’u yatay eksene dik tut, fazla salınım yapma."
        ],
        PF: [
            "PF (Dikey Yukarı): Her zaman stringer (düz) dikiş kullan, geniş weave (salınım) dikiş kontrolünü zorlaştırır.",
            "PF (Dikey Yukarı): Kökte kısa bekleme yap; kenarlarda hafif durarak birleşmeyi sağla."
        ],
        PG: [
            "PG (Dikey Aşağı): İnce saclarda hızlı ve kısa dikişlerle ilerle; ısıyı düşük tut.",
            "PG (Dikey Aşağı): Havuzu takip et, aşırı erimeye izin verme."
        ],
        PE: [
            "PE (Tavan): En zor pozisyondur; akım ve voltajı bir kademe düşür, gaz debisini +1–2 L/dk artır.",
            "PE (Tavan): Havuzun düşmemesi için kısa ve ritmik hareket et. Panik yok — ritim her şeydir."
        ]
    },
    material: {
        carbon_steel: [ // Groups 1.1, 1.2, 1.4, 5.1
            "Karbon Çelik: CE değeri yüksek malzemede (kalın kesit) ön ısıtma yapmadan kaynağa başlama.",
            "Karbon Çelik: Kalın kesitlerde ısıyı yavaş düşür, çatlak riskini azaltırsın."
        ],
        stainless_steel: [ // Group 8.1, 10.1
            "Paslanmaz Çelik: Pasolar arası sıcaklığı 150 °C’nin altında tut; renklenme ve karbür çökelmesi önlenir.",
            "Paslanmaz Çelik: Her paso sonrası paslanmaz tel fırça ile temizle, siyah tabaka bırakma."
        ],
        aluminum: [ // Group 22.2, 23.1
            "Alüminyum: Kaynak öncesi oksit tabakasını paslanmaz çelik fırça ile mutlaka temizle.",
            "Alüminyum: Isı girdisini kontrollü tut; göçme riski yüksektir.",
            "Alüminyum: Tel beslemede tıkanma olursa nozul ve liner’ı kontrol et."
        ]
    },
    process: {
        '141': ["TIG: Tungsten elektrot ucunu keskin tut ve malzeme ile temas ettirmekten kaçın."],
        '111': ["MMA: Elektrotu kuru tut. Nemli elektrot gözenek yapar."]
    }
};

const getWelderNotes = (position, group, processCode) => {
    let notes = [...notesLibrary.general];

    if (notesLibrary.position[position]) {
        notes.push(...notesLibrary.position[position]);
    }

    if (['1.1', '1.2', '1.4', '5.1'].includes(group)) {
        notes.push(...notesLibrary.material.carbon_steel);
    } else if (['8.1', '10.1'].includes(group)) {
        notes.push(...notesLibrary.material.stainless_steel);
    } else if (['22.2', '23.1'].includes(group)) {
        notes.push(...notesLibrary.material.aluminum);
    }

    if (notesLibrary.process[processCode]) {
        notes.push(...notesLibrary.process[processCode]);
    }

    return notes;
};


export const generateWPSRecommendation = (inputs, library) => {
    const { material1, thickness, position, jointType, jointDetail, jointAngle, rootGap, processCode: userProcessCode } = inputs;
    const { fillerMaterials, shieldingGases } = library;
    
    let recommendations = {
        process: {},
        filler: {},
        gas: {},
        pass_plan: [],
        temperatures: {},
        notes: [],
        reasoning: [],
        efficiency: 0.8,
        welding_process_code: null,
        filler_material_id: null,
        filler_diameter: null,
        shielding_gas_id: null,
        gas_flow_rate: null,
        preheat_temperature: null,
        interpass_temperature: null,
    };

    if (!material1) return recommendations;

    const group = material1.iso_15608_group;
    const t = parseFloat(thickness);

    // 1. Process Selection & Polarity
    let suggestedProcessCode = '111'; // Default MMA
    let suggestedPolarity = 'DC+';

    if (['1.1', '1.2', '1.4', '5.1'].includes(group)) { // Carbon Steels
        suggestedProcessCode = '135'; // MAG
        suggestedPolarity = 'DC+';
        recommendations.reasoning.push("Karbon çeliği için en yaygın ve verimli proses MAG (135) kaynağıdır (DC+).");
    } else if (group === '8.1') { // Austenitic Stainless Steel
        suggestedProcessCode = t <= 3 ? '141' : '131'; // TIG or MIG
        suggestedPolarity = suggestedProcessCode === '141' ? 'DC-' : 'DC+';
        recommendations.reasoning.push(t <= 3 ? "İnce paslanmaz çelik için TIG (141) hassas kontrol sağlar (DC-)." : "Kalın paslanmaz çelik için MIG (131) daha verimlidir (DC+).");
    } else if (['22.2', '23.1'].includes(group)) { // Aluminum
        suggestedProcessCode = t < 5 ? '141' : '131'; // TIG or MIG
        suggestedPolarity = 'AC'; // Aluminum is best welded with AC
        recommendations.reasoning.push(`Alüminyum alaşımları için ${t < 5 ? 'TIG (141)' : 'MIG (131)'} kaynağı AC polarite ile önerilir.`);
    } else if (group === '10.1') { // Duplex Stainless
        suggestedProcessCode = '131'; // MIG
        suggestedPolarity = 'DC+';
        recommendations.reasoning.push("Dupleks paslanmaz çelikler için MIG (131) iyi bir seçimdir (DC+).");
    } else {
        recommendations.reasoning.push("Malzeme grubu için özel bir öneri bulunamadı, genel amaçlı MMA (111) alternatiftir.");
    }
    
    const finalProcessCode = userProcessCode || suggestedProcessCode;
    const processMap = { '135': 'MAG', '131': 'MIG', '141': 'TIG', '111': 'MMA' };
    recommendations.welding_process_code = finalProcessCode;
    recommendations.process = { code: finalProcessCode, name: processMap[finalProcessCode] };
    if(userProcessCode && userProcessCode !== suggestedProcessCode) {
        recommendations.reasoning.push(`Kullanıcı tarafından ${processMap[userProcessCode]} (${userProcessCode}) prosesi seçildi.`);
    }
    
    const efficiency = { '135': 0.85, '131': 0.85, '141': 0.65, '111': 0.8 }[finalProcessCode] || 0.8;
    recommendations.efficiency = efficiency;

    // 2. Filler Material & Diameter
    const compatibleFillers = fillerMaterials.filter(f => f.compatible_material_groups.includes(group));
    if (compatibleFillers.length > 0) {
        recommendations.filler.id = compatibleFillers[0].id;
        recommendations.filler.classification = compatibleFillers[0].classification;
        recommendations.filler_material_id = compatibleFillers[0].id;
        recommendations.reasoning.push(`Malzeme grubuna (${group}) uygun ${compatibleFillers[0].classification} dolgu teli seçildi.`);

        let diameter = 1.0;
        if (t > 5 && t <= 12) diameter = 1.2;
        else if (t > 12) diameter = 1.2;
        
        if (['PF', 'PG', 'PE'].includes(position) && diameter > 1.0) {
            diameter = 1.0;
            recommendations.reasoning.push("Zor pozisyonlar için daha iyi kontrol sağlamak amacıyla tel çapı 1.0mm'ye düşürüldü.");
        }
        recommendations.filler_diameter = diameter;
        recommendations.filler.diameter = diameter;
        recommendations.reasoning.push(`Kalınlık (${t}mm) ve pozisyona (${position}) göre ${diameter}mm tel çapı önerildi.`);
    }

    // 3. Shielding Gas
    let gasName = 'I1'; // Default
    if (finalProcessCode === '135' && ['1.1', '1.2'].includes(group)) {
        gasName = t <= 3 ? 'M20' : 'M21';
        recommendations.reasoning.push(t <= 3 ? "İnce karbon çeliği için daha az sıçrantılı M20 gazı önerildi." : "Genel karbon çeliği için standart M21 gazı seçildi.");
    } else if (['131', '135'].includes(finalProcessCode) && group === '8.1') {
        gasName = 'M12';
        recommendations.reasoning.push("Paslanmaz çelik MIG kaynağı için düşük oksitleyici M12 gazı seçildi.");
    } else if (finalProcessCode === '131' && ['22.2', '23.1'].includes(group)) {
        gasName = t > 8 ? 'I3' : 'I1';
        recommendations.reasoning.push(t > 8 ? "Kalın alüminyumda daha iyi nüfuziyet için Helyum karışımlı I3 gazı önerildi." : "Genel alüminyum kaynağı için saf Argon (I1) seçildi.");
    } else if (finalProcessCode === '141') {
        gasName = 'I1';
        recommendations.reasoning.push("TIG kaynağı için saf Argon (I1) koruyucu gazı seçildi.");
    }
    const selectedGas = shieldingGases.find(g => g.name.startsWith(gasName));
    if (selectedGas) {
        recommendations.gas.id = selectedGas.id;
        recommendations.gas.name = selectedGas.name;
        recommendations.gas.flow = `12-15`;
        recommendations.shielding_gas_id = selectedGas.id;
        recommendations.gas_flow_rate = '12-15';
        recommendations.reasoning.push(`Standart uygulama olarak 12-15 L/dk debi aralığı önerildi.`);
    }

    // 4. Temperatures
    if (['1.1', '1.2'].includes(group)) {
        if (t <= 6) recommendations.temperatures.preheat = 'Gereksiz';
        else if (t <= 20) recommendations.temperatures.preheat = '50-75';
        else recommendations.temperatures.preheat = '75-125';
        recommendations.temperatures.interpass = '250 °C max';
        recommendations.reasoning.push(`Karbon çeliği kalınlığına göre ön tav ve pasolar arası sıcaklık belirlendi.`);
    } else if (group === '8.1' || group === '10.1') {
        recommendations.temperatures.preheat = 'Gereksiz';
        recommendations.temperatures.interpass = group === '10.1' ? '150 °C max' : '170 °C max';
        recommendations.reasoning.push(`Paslanmaz çelik için ön tav gerekmez, ancak pasolar arası sıcaklık kontrol edilmelidir.`);
    } else if (['22.2', '23.1'].includes(group)) {
        recommendations.temperatures.preheat = 'Gereksiz (max 50°C)';
        recommendations.temperatures.interpass = '120 °C max';
        recommendations.reasoning.push(`Alüminyum için pasolar arası sıcaklık kontrolü kritik öneme sahiptir.`);
    }
    recommendations.preheat_temperature = recommendations.temperatures.preheat;
    recommendations.interpass_temperature = recommendations.temperatures.interpass;

    // 5. Pass Plan, Electrical Parameters & Heat Input
    const posMod = getPositionModifier(position);
    const diameter = recommendations.filler.diameter || 1.0;
    
    let passCount = 1;
    if (jointType === 'Butt') {
        if (t > 3 && t <= 8) passCount = 2;
        else if (t > 8 && t <= 15) passCount = 3;
        else if (t > 15) passCount = 4 + Math.floor((t - 15) / 5);
    } else { // Fillet
        const a = t * 0.7; // throat thickness
        if (a > 4 && a <= 7) passCount = 2;
        else if (a > 7) passCount = 3;
    }

    recommendations.pass_plan = []; // Clear previous plan before generating a new one
    for (let i = 1; i <= passCount; i++) {
        const isRootPass = i === 1;
        const isCapPass = i === passCount && passCount > 1;

        let passName = "Dolgu Paso";
        if (isRootPass) passName = "Kök Paso";
        if (isCapPass) passName = "Kapak Paso";
        if (passCount === 1) passName = "Tek Paso";

        let baseAmps, baseVolts, baseSpeed;
        if (diameter === 1.0) {
            baseAmps = interpolate(t, 1, 10, 100, 220);
            baseVolts = interpolate(baseAmps, 100, 220, 18, 25);
            baseSpeed = interpolate(baseAmps, 100, 220, 400, 250);
        } else { // 1.2mm
            baseAmps = interpolate(t, 3, 25, 140, 300);
            baseVolts = interpolate(baseAmps, 140, 300, 20, 29);
            baseSpeed = interpolate(baseAmps, 140, 300, 450, 300);
        }
        
        let ampModifier = 1.0;
        if (isRootPass) ampModifier = 0.90; // Root pass is cooler
        if (isCapPass) ampModifier = 1.05; // Cap pass is hotter for a good finish

        const avgAmps = Math.round(baseAmps * posMod.amp * ampModifier);
        const avgVolts = Math.round(baseVolts * posMod.volt * (isRootPass ? 0.95 : 1.0) * 10) / 10;
        const speed = Math.round(baseSpeed * posMod.speed);
        
        const ampRange = Math.max(10, Math.round(avgAmps * 0.08));
        const voltRange = Math.max(1, Math.round(avgVolts * 0.05 * 10) / 10);

        const minAmps = avgAmps - ampRange;
        const maxAmps = avgAmps + ampRange;
        const minVolts = avgVolts - voltRange;
        const maxVolts = avgVolts + voltRange;

        const heatInput = ((avgVolts * avgAmps * 60 * efficiency) / (1000 * speed)).toFixed(2);

        recommendations.pass_plan.push({
            pass: passName,
            process: finalProcessCode,
            technique: isRootPass ? 'Stringer' : 'Weave',
            current_polarity: suggestedPolarity,
            min_current_a: minAmps,
            max_current_a: maxAmps,
            min_voltage_v: minVolts.toFixed(1),
            max_voltage_v: maxVolts.toFixed(1),
            travel_speed: speed,
            heat_input: heatInput,
        });
    }
    recommendations.reasoning.push(`${passCount} paso, birleşim tipi, kalınlık ve pozisyona göre hassas parametrelerle planlandı.`);

    // 6. Welder Notes
    recommendations.notes = getWelderNotes(position, group, finalProcessCode);

    return recommendations;
};