export const getFixtureVerificationRules = (criticalityClass) => {
    if (criticalityClass === 'Kritik') {
        return {
            verificationPeriodMonths: 2,
            sampleCountRequired: 2,
        };
    }

    return {
        verificationPeriodMonths: 3,
        sampleCountRequired: 1,
    };
};
