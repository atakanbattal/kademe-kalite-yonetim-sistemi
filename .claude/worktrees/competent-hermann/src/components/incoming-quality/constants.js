export const materialStandards = {
      "S235JR": ["EN 10025-2"],
      "S235J0": ["EN 10025-2"],
      "S235J2": ["EN 10025-2"],
      "S275JR": ["EN 10025-2"],
      "S275J0": ["EN 10025-2"],
      "S275J2": ["EN 10025-2"],
      "S355JR": ["EN 10025-2"],
      "S355J0": ["EN 10025-2"],
      "S355J2": ["EN 10025-2"],
      "S355K2": ["EN 10025-2"],
      "P265GH": ["EN 10028-2"],
      "P355GH": ["EN 10028-2"],
      "Hardox 400": ["Proprietary"],
      "Hardox 450": ["Proprietary"],
      "Hardox 500": ["Proprietary"],
      "Raex 400": ["Proprietary"],
      "Raex 500": ["Proprietary"],
      "St52-3": ["DIN 17100"],
      "304 Paslanmaz Çelik": ["ASTM A240", "EN 10088-2"],
      "304L Paslanmaz Çelik": ["ASTM A240", "EN 10088-2"],
      "316 Paslanmaz Çelik": ["ASTM A240", "EN 10088-2"],
      "316L Paslanmaz Çelik": ["ASTM A240", "EN 10088-2"],
      "316Ti Paslanmaz Çelik": ["ASTM A240", "EN 10088-2"],
      "430 Paslanmaz Çelik": ["ASTM A240", "EN 10088-2"],
    };
    
    export const materialQualityOptions = Object.keys(materialStandards);
    export const allStandardOptions = [...new Set(Object.values(materialStandards).flat())];