const SolarSizingEngine = {

    settings: {
        performanceRatio: 0.80,
        inverterDesignMargin: 1.25,
        loadGrowthFactor: 1.15,
        defaultPanelWatts: 550,
        defaultBatteryVoltage: 48,
        defaultBatteryDoD: 0.90,
        defaultBatteryEfficiency: 0.95
    },

    calculateDailyEnergy(appliances) {

        let totalDailyEnergy = 0;

        appliances.forEach(appliance => {

            const watts = Number(appliance.watts) || 0;
            const quantity = Number(appliance.quantity) || 0;
            const hours = Number(appliance.hours) || 0;

            const energy = (watts * quantity * hours) / 1000;

            appliance.dailyEnergy = energy;

            totalDailyEnergy += energy;
        });

        return totalDailyEnergy;
    },

    calculateContinuousLoad(appliances) {

        let totalLoad = 0;

        appliances.forEach(appliance => {

            const watts = Number(appliance.watts) || 0;
            const quantity = Number(appliance.quantity) || 0;

            totalLoad += watts * quantity;
        });

        return totalLoad;
    },

    calculateStartingLoad(appliances) {

        let totalLoad = 0;

        appliances.forEach(appliance => {

            const startingWatts =
                Number(appliance.startingWatts || appliance.watts) || 0;

            const quantity = Number(appliance.quantity) || 0;

            totalLoad += startingWatts * quantity;
        });

        return totalLoad;
    },

    calculatePVSize(dailyEnergy, sunHours, performanceRatio = this.settings.performanceRatio) {

        if (!dailyEnergy || !sunHours || !performanceRatio) {
            return 0;
        }

        return dailyEnergy / (sunHours * performanceRatio);
    },

    calculatePanelCount(pvKw, panelWatts = this.settings.defaultPanelWatts) {

        if (!pvKw || !panelWatts) {
            return 0;
        }

        const requiredWatts = pvKw * 1000;

        return Math.ceil(requiredWatts / panelWatts);
    },

    calculateActualPV(panelCount, panelWatts = this.settings.defaultPanelWatts) {

        return (panelCount * panelWatts) / 1000;
    },

    calculateRequiredInverterPower(
        continuousLoad,
        designMargin = this.settings.inverterDesignMargin
    ) {

        if (!continuousLoad) {
            return 0;
        }

        return continuousLoad * designMargin;
    },

    calculateBatteryCapacity(
        backupEnergy,
        dod = this.settings.defaultBatteryDoD,
        efficiency = this.settings.defaultBatteryEfficiency
    ) {

        if (!backupEnergy || !dod || !efficiency) {
            return 0;
        }

        return backupEnergy / (dod * efficiency);
    },

    calculateBatteryCount(requiredBatteryKwh, batteryUnitKwh) {

        if (!requiredBatteryKwh || !batteryUnitKwh) {
            return 0;
        }

        return Math.ceil(requiredBatteryKwh / batteryUnitKwh);
    },

    calculateBatteryCurrent(
        inverterPowerKw,
        batteryVoltage = this.settings.defaultBatteryVoltage,
        efficiency = this.settings.defaultBatteryEfficiency
    ) {

        if (!inverterPowerKw || !batteryVoltage || !efficiency) {
            return 0;
        }

        return (inverterPowerKw * 1000) /
            (batteryVoltage * efficiency);
    },

    validateSystem(system) {

        const errors = [];
        const warnings = [];

        if (
            system.inverterContinuousRatingKw &&
            system.requiredInverterKw &&
            system.inverterContinuousRatingKw < system.requiredInverterKw
        ) {
            errors.push(
                "Selected inverter continuous rating is below the required continuous load."
            );
        }

        if (
            system.inverterSurgeRatingKw &&
            system.requiredSurgeKw &&
            system.inverterSurgeRatingKw < system.requiredSurgeKw
        ) {
            errors.push(
                "Selected inverter surge rating is below the required starting load."
            );
        }

        if (
            system.inverterMaxPvKw &&
            system.selectedPvKw &&
            system.inverterMaxPvKw < system.selectedPvKw
        ) {
            errors.push(
                "Selected PV array exceeds the inverter maximum PV input."
            );
        }

        if (
            system.batteryMaxChargeKw &&
            system.pvChargePowerKw &&
            system.pvChargePowerKw > system.batteryMaxChargeKw
        ) {
            errors.push(
                "PV charging power exceeds the battery charging capability."
            );
        }

        if (
            system.batteryMaxChargeCurrent &&
            system.batteryChargeCurrent &&
            system.batteryChargeCurrent > system.batteryMaxChargeCurrent
        ) {
            errors.push(
                "Battery charging current exceeds the battery limit."
            );
        }

        if (
            system.requiredInverterKw &&
            system.requiredInverterKw > 5
        ) {
            warnings.push(
                "Large inverter requirement detected. Final design should be verified by an engineer."
            );
        }

        if (
            system.selectedPvKw &&
            system.requiredInverterKw &&
            system.selectedPvKw > system.requiredInverterKw * 1.2
        ) {
            warnings.push(
                "PV-to-inverter ratio is above the default preliminary design range."
            );
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    },

    calculate(appliances, options = {}) {

        const location =
            options.location || "Nairobi";

        const locationData =
            KenyaSolarLocations[location] ||
            KenyaSolarLocations.Nairobi;

        const sunHours =
            Number(options.sunHours || locationData.sunHours);

        const dailyEnergy =
            this.calculateDailyEnergy(appliances);

        const continuousLoad =
            this.calculateContinuousLoad(appliances);

        const startingLoad =
            this.calculateStartingLoad(appliances);

        const requiredInverterKw =
            this.calculateRequiredInverterPower(
                continuousLoad
            ) / 1000;

        const requiredPvKw =
            this.calculatePVSize(
                dailyEnergy,
                sunHours
            );

        const panelWatts =
            Number(
                options.panelWatts ||
                this.settings.defaultPanelWatts
            );

        const panelCount =
            this.calculatePanelCount(
                requiredPvKw,
                panelWatts
            );

        const actualPvKw =
            this.calculateActualPV(
                panelCount,
                panelWatts
            );

        const backupHours =
            Number(options.backupHours || 0);

        const backupEnergy =
            (dailyEnergy / 24) * backupHours;

        const requiredBatteryKwh =
            this.calculateBatteryCapacity(
                backupEnergy
            );

        const batteryUnitKwh =
            Number(options.batteryUnitKwh || 5.12);

        const batteryCount =
            this.calculateBatteryCount(
                requiredBatteryKwh,
                batteryUnitKwh
            );

        const batteryCurrent =
            this.calculateBatteryCurrent(
                requiredInverterKw
            );

        const result = {

            location,

            sunHours,

            dailyEnergyKwh:
                Number(dailyEnergy.toFixed(2)),

            continuousLoadKw:
                Number((continuousLoad / 1000).toFixed(2)),

            startingLoadKw:
                Number((startingLoad / 1000).toFixed(2)),

            requiredInverterKw:
                Number(requiredInverterKw.toFixed(2)),

            requiredPvKw:
                Number(requiredPvKw.toFixed(2)),

            panelWatts,

            panelCount,

            actualPvKw:
                Number(actualPvKw.toFixed(2)),

            backupHours,

            backupEnergyKwh:
                Number(backupEnergy.toFixed(2)),

            requiredBatteryKwh:
                Number(requiredBatteryKwh.toFixed(2)),

            batteryUnitKwh,

            batteryCount,

            batteryCurrentA:
                Number(batteryCurrent.toFixed(1))
        };

        return result;
    }

};
