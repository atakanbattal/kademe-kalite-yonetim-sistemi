export function formatDuration(milliseconds) {
    if (typeof milliseconds !== 'number' || isNaN(milliseconds) || milliseconds < 0) {
        return "0 dk";
    }

    const totalMinutes = Math.floor(milliseconds / 60000);
    
    if (totalMinutes < 1) {
        const seconds = Math.floor(milliseconds / 1000);
        return `${seconds} sn`;
    }

    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    let result = '';
    if (days > 0) {
        result += `${days}g `;
    }
    if (hours > 0) {
        result += `${hours}s `;
    }
    if (minutes > 0 || result === '') {
        result += `${minutes}dk`;
    }

    return result.trim();
}