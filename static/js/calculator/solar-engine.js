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

    validateAppliances(appliances) {
        if (!Array.isArray(appliances) || appliances.length === 0) {
            throw new Error("Add at least one appliance.");
        }
        for (const appliance of appliances) {
            if (!appliance || typeof appliance !== "object") {
                throw new Error("Each appliance must have valid details.");
            }
            if (typeof appliance.name !== "string" || !appliance.name.trim()) {
                throw new Error("Each appliance needs a name.");
            }
            const watts = Number(appliance.watts);
            const quantity = Number(appliance.quantity);
            const hours = Number(appliance.hours);
            if (!Number.isFinite(watts) || watts <= 0) {
                throw new Error("Appliance wattage must be a positive number.");
            }
            if (!Number.isInteger(quantity) || quantity <= 0) {
                throw new Error("Appliance quantity must be a whole number greater than zero.");
            }
            if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
                throw new Error("Daily usage must be between 0 and 24 hours.");
            }
            if (appliance.startingWatts !== undefined && appliance.startingWatts !== null && appliance.startingWatts !== "") {
                const startingWatts = Number(appliance.startingWatts);
                if (!Number.isFinite(startingWatts) || startingWatts <= 0) {
                    throw new Error("Starting watts must be positive or left blank.");
                }
            }
        }
    },
    calculateDailyEnergy(appliances) {
        this.validateAppliances(appliances);

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
        this.validateAppliances(appliances);

        let totalLoad = 0;

        appliances.forEach(appliance => {

            const watts = Number(appliance.watts) || 0;
            const quantity = Number(appliance.quantity) || 0;

            totalLoad += watts * quantity;
        });

        return totalLoad;
    },

    calculateStartingLoad(appliances) {
        this.validateAppliances(appliances);

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

    estimateBatteryChargingTime(options = {}) {
        const {
            batteryCapacityKwh,
            startingSocPercent = 0,
            targetSocPercent = 100,
            panelCount,
            panelWatts,
            efficiency = 0.90
        } = options;

        const values = [
            batteryCapacityKwh, startingSocPercent,
            targetSocPercent, panelCount, panelWatts, efficiency
        ];

        if (!values.every(Number.isFinite)) {
            throw new Error("Enter valid numbers for all charging inputs.");
        }
        if (batteryCapacityKwh <= 0 ||
            !Number.isInteger(panelCount) || panelCount <= 0 ||
            panelWatts <= 0 ||
            startingSocPercent < 0 || startingSocPercent > 100 ||
            targetSocPercent < 0 || targetSocPercent > 100 ||
            targetSocPercent <= startingSocPercent ||
            efficiency <= 0 || efficiency > 1) {
            throw new Error("Check capacity, panel count, wattage, SOC and efficiency values.");
        }

        const energyNeededKwh =
            batteryCapacityKwh * (targetSocPercent - startingSocPercent) / 100;
        const arrayPowerKw = panelCount * panelWatts / 1000;
        const effectivePowerKw = arrayPowerKw * efficiency;
        const chargingTimeHours = energyNeededKwh / effectivePowerKw;

        if (!Number.isFinite(chargingTimeHours) || chargingTimeHours <= 0) {
            throw new Error("Unable to calculate charging time from these inputs.");
        }

        return {
            energyNeededKwh,
            arrayPowerKw,
            effectivePowerKw,
            chargingTimeHours,
            estimatedMinutes: Math.ceil(chargingTimeHours * 60)
        };
    },
    calculate(appliances, options = {}) {

        const location =
            options.location || "Nairobi";

        const locationData =
            KenyaSolarLocations[location] ||
            KenyaSolarLocations.Nairobi;

        const sunHoursInput = options.sunHours;
        const sunHours = (sunHoursInput === undefined || sunHoursInput === null || sunHoursInput === "") ? Number(locationData.sunHours) : Number(sunHoursInput);
        if (!Number.isFinite(sunHours) || sunHours <= 0) {
            throw new Error("Sunlight hours must be a positive number.");
        }

        const dailyEnergy =
            this.calculateDailyEnergy(appliances);

        const continuousLoad =
            this.calculateContinuousLoad(appliances);

        const startingLoad =
            this.calculateStartingLoad(appliances);

        const loadGrowthFactor =
            Number(this.settings.loadGrowthFactor || 1);

        const designDailyEnergy =
            dailyEnergy * loadGrowthFactor;

        const designContinuousLoad =
            continuousLoad * loadGrowthFactor;
        const designStartingLoad =
            startingLoad * loadGrowthFactor;


        const requiredInverterKw =
            this.calculateRequiredInverterPower(
                designContinuousLoad
            ) / 1000;

        const requiredPvKw =
            this.calculatePVSize(
                designDailyEnergy,
                sunHours
            );

        const panelWattsInput = options.panelWatts;
        const panelWatts = (panelWattsInput === undefined || panelWattsInput === null || panelWattsInput === "") ? Number(this.settings.defaultPanelWatts) : Number(panelWattsInput);
        if (!Number.isFinite(panelWatts) || panelWatts <= 0) {
            throw new Error("Solar panel wattage must be a positive number.");
        }

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

        const backupHoursInput = options.backupHours;
        const backupHours = (backupHoursInput === undefined || backupHoursInput === null || backupHoursInput === "") ? 0 : Number(backupHoursInput);
        if (!Number.isFinite(backupHours) || backupHours < 0 || backupHours > 24) {
            throw new Error("Backup hours must be between 0 and 24.");
        }

        const backupEnergy =
            (designDailyEnergy / 24) * backupHours;

        const requiredBatteryKwh =
            this.calculateBatteryCapacity(
                backupEnergy
            );

        const batteryUnitInput = options.batteryUnitKwh;
        const batteryUnitKwh = (batteryUnitInput === undefined || batteryUnitInput === null || batteryUnitInput === "") ? 5.12 : Number(batteryUnitInput);
        if (!Number.isFinite(batteryUnitKwh) || batteryUnitKwh <= 0) {
            throw new Error("Battery unit capacity must be a positive number.");
        }

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

            designDailyEnergyKwh:
                Number(designDailyEnergy.toFixed(2)),

            loadGrowthFactor,

            continuousLoadKw:
                Number((continuousLoad / 1000).toFixed(2)),

            startingLoadKw:
                Number((startingLoad / 1000).toFixed(2)),
            designStartingLoadKw:
                Number((designStartingLoad / 1000).toFixed(2)),


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
