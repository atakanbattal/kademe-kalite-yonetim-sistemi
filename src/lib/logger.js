// Production-safe logger utility
// Development'ta tüm loglar görünür, production'da sadece errors

const isDev = import.meta.env.DEV;

export const logger = {
    log: (...args) => {
        if (isDev) {
            console.log(...args);
        }
    },
    
    info: (...args) => {
        if (isDev) {
            console.info(...args);
        }
    },
    
    warn: (...args) => {
        console.warn(...args); // Production'da da warning göster
    },
    
    error: (...args) => {
        console.error(...args); // Production'da da error göster
    },
    
    group: (label) => {
        if (isDev) {
            console.group(label);
        }
    },
    
    groupEnd: () => {
        if (isDev) {
            console.groupEnd();
        }
    },
    
    table: (data) => {
        if (isDev) {
            console.table(data);
        }
    },
    
    time: (label) => {
        if (isDev) {
            console.time(label);
        }
    },
    
    timeEnd: (label) => {
        if (isDev) {
            console.timeEnd(label);
        }
    },
};

export default logger;

