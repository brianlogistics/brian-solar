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

            const energy =
                (watts * quantity * hours) / 1000;

            appliance.dailyEnergy = energy;
            totalDailyEnergy += energy;
        });

        return totalDailyEnergy;
    },

    calculateDesignEnergy(dailyEnergyKwh) {
        const growthFactor =
            Number(
                this.settings.loadGrowthFactor
            ) || 1;

        return dailyEnergyKwh * growthFactor;
    },

    calculateContinuousLoad(appliances) {
        let totalLoad = 0;

        appliances.forEach(appliance => {
            const watts = Number(appliance.watts) || 0;

            const peakQuantity =
                Number(
                    appliance.peakQuantity ??
                    appliance.quantity
                ) || 0;

            totalLoad += watts * peakQuantity;
        });

        return totalLoad;
    },

    calculateStartingLoad(appliances) {
        let totalLoad = 0;

        appliances.forEach(appliance => {
            const watts =
                Number(appliance.watts) || 0;

            const peakQuantity =
                Number(
                    appliance.peakQuantity ??
                    appliance.quantity
                ) || 0;

            const startingQuantity =
                Number(
                    appliance.startingQuantity
                ) || 0;

            /*
             * If starting watts are known, calculate the
             * actual starting demand:
             *
             * running units × running watts
             * +
             * starting units × starting watts
             *
             * If starting watts are not supplied, do not
             * invent a surge value. Use the normal running
             * watts for those units and leave the surge
             * requirement conservative/unknown.
             */
            const hasStartingWatts =
                appliance.startingWatts !== null &&
                appliance.startingWatts !== undefined &&
                Number(appliance.startingWatts) > 0;

            if (hasStartingWatts) {
                const startingWatts =
                    Number(appliance.startingWatts);

                const safeStartingQuantity =
                    Math.min(
                        startingQuantity,
                        peakQuantity
                    );

                const runningUnits =
                    Math.max(
                        peakQuantity -
                        safeStartingQuantity,
                        0
                    );

                totalLoad +=
                    (runningUnits * watts) +
                    (safeStartingQuantity * startingWatts);

            } else {
                /*
                 * Starting watts are unknown.
                 * Do not assume a motor/compressor multiplier.
                 * Use running demand only.
                 */
                totalLoad +=
                    peakQuantity * watts;
            }
        });

        return totalLoad;
    },

    calculateEssentialBackupLoad(appliances) {
        let totalLoad = 0;

        appliances.forEach(appliance => {
            if (!appliance.essential) return;

            const watts = Number(appliance.watts) || 0;

            const peakQuantity =
                Number(
                    appliance.peakQuantity ??
                    appliance.quantity
                ) || 0;

            totalLoad += watts * peakQuantity;
        });

        return totalLoad;
    },

    calculateEssentialBackupEnergy(
        appliances,
        backupHours
    ) {
        const essentialLoadWatts =
            this.calculateEssentialBackupLoad(
                appliances
            );

        const hours =
            Number(backupHours) || 0;

        return (
            essentialLoadWatts * hours
        ) / 1000;
    },

    calculatePVSize(
        dailyEnergy,
        sunHours,
        performanceRatio =
            this.settings.performanceRatio
    ) {
        if (
            !dailyEnergy ||
            !sunHours ||
            !performanceRatio
        ) {
            return 0;
        }

        return (
            dailyEnergy /
            (sunHours * performanceRatio)
        );
    },

    calculatePanelCount(
        pvKw,
        panelWatts =
            this.settings.defaultPanelWatts
    ) {
        if (!pvKw || !panelWatts) return 0;

        const requiredWatts =
            pvKw * 1000;

        return Math.ceil(
            requiredWatts / panelWatts
        );
    },

    calculateActualPV(
        panelCount,
        panelWatts =
            this.settings.defaultPanelWatts
    ) {
        return (
            panelCount * panelWatts
        ) / 1000;
    },

    calculateRequiredInverterPower(
        continuousLoad,
        designMargin =
            this.settings.inverterDesignMargin
    ) {
        if (!continuousLoad) return 0;

        return (
            continuousLoad *
            designMargin
        );
    },

    calculateBatteryCapacity(
        backupEnergy,
        dod =
            this.settings.defaultBatteryDoD,
        efficiency =
            this.settings.defaultBatteryEfficiency
    ) {
        if (
            !backupEnergy ||
            !dod ||
            !efficiency
        ) {
            return 0;
        }

        return (
            backupEnergy /
            (dod * efficiency)
        );
    },

    calculateBatteryCount(
        requiredBatteryKwh,
        batteryUnitKwh
    ) {
        if (
            !requiredBatteryKwh ||
            !batteryUnitKwh
        ) {
            return 0;
        }

        return Math.ceil(
            requiredBatteryKwh /
            batteryUnitKwh
        );
    },

    calculateBatteryCurrent(
        inverterPowerKw,
        batteryVoltage =
            this.settings.defaultBatteryVoltage,
        efficiency =
            this.settings.defaultBatteryEfficiency
    ) {
        if (
            !inverterPowerKw ||
            !batteryVoltage ||
            !efficiency
        ) {
            return 0;
        }

        return (
            (inverterPowerKw * 1000) /
            (batteryVoltage * efficiency)
        );
    },

    validateSystem(system) {
        const errors = [];
        const warnings = [];

        const inverter =
            system.inverter || {};

        const battery =
            system.battery || {};

        const inverterContinuousRatingKw =
            Number(
                inverter.continuousRatingKw ??
                system.inverterContinuousRatingKw
            ) || 0;

        const inverterSurgeRatingKw =
            Number(
                inverter.surgeRatingKw ??
                system.inverterSurgeRatingKw
            ) || 0;

        const inverterMaxPvKw =
            Number(
                inverter.maxPvKw ??
                system.inverterMaxPvKw
            ) || 0;

        const batteryMaxChargeKw =
            Number(
                battery.maxChargeKw ??
                system.batteryMaxChargeKw
            ) || 0;

        const batteryMaxChargeCurrent =
            Number(
                battery.maxChargeA ??
                system.batteryMaxChargeCurrent
            ) || 0;

        if (
            inverterContinuousRatingKw &&
            system.requiredInverterKw &&
            inverterContinuousRatingKw <
                system.requiredInverterKw
        ) {
            errors.push(
                "Selected inverter continuous rating is below the required continuous load."
            );
        }

        if (
            inverterSurgeRatingKw &&
            system.requiredSurgeKw &&
            inverterSurgeRatingKw <
                system.requiredSurgeKw
        ) {
            errors.push(
                "Selected inverter surge rating is below the required starting load."
            );
        }

        if (
            inverterMaxPvKw &&
            system.selectedPvKw &&
            inverterMaxPvKw <
                system.selectedPvKw
        ) {
            errors.push(
                "Selected PV array exceeds the inverter maximum PV input."
            );
        }

        if (
            batteryMaxChargeKw &&
            system.pvChargePowerKw &&
            system.pvChargePowerKw >
                batteryMaxChargeKw
        ) {
            errors.push(
                "PV charging power exceeds the battery charging capability."
            );
        }

        if (
            batteryMaxChargeCurrent &&
            system.batteryChargeCurrent &&
            system.batteryChargeCurrent >
                batteryMaxChargeCurrent
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
            system.selectedPvKw >
                system.requiredInverterKw * 1.2
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

    calculateApproximateInverterClass(requiredInverterKw) {
        const classes = [
            1,
            2,
            3,
            5,
            8,
            10,
            12
        ];
        const required =
            Number(requiredInverterKw);
        if (
            !Number.isFinite(required) ||
            required <= 0
        ) {
            return null;
        }
        const matchingClass =
            classes.find(
                inverterClass =>
                    inverterClass >= required
            );
        return matchingClass
            ? matchingClass
            : null;
    },

    calculate(appliances, options = {}) {
        const location =
            options.location || "Nairobi";

        const locationData =
            KenyaSolarLocations[location] ||
            KenyaSolarLocations.Nairobi;

        const sunHours =
            Number(
                options.sunHours ||
                locationData.sunHours
            );

        const dailyEnergy =
            this.calculateDailyEnergy(
                appliances
            );

        const designEnergy =
            this.calculateDesignEnergy(
                dailyEnergy
            );

        const continuousLoad =
            this.calculateContinuousLoad(
                appliances
            );

        const startingLoad =
            this.calculateStartingLoad(
                appliances
            );

        const essentialBackupLoad =
            this.calculateEssentialBackupLoad(
                appliances
            );

        const requiredInverterKw =
            this.calculateRequiredInverterPower(
                continuousLoad
            ) / 1000;
        const approximateInverterClassKw =
            this.calculateApproximateInverterClass(
                requiredInverterKw
            );

        const requiredPvKw =
            this.calculatePVSize(
                designEnergy,
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
            Number(
                options.backupHours || 0
            );

        const backupEnergy =
            this.calculateEssentialBackupEnergy(
                appliances,
                backupHours
            );

        const requiredBatteryKwh =
            this.calculateBatteryCapacity(
                backupEnergy
            );

        const batteryUnitKwh =
            Number(options.batteryUnitKwh) || null;

        const batteryCount =
            batteryUnitKwh
                ? this.calculateBatteryCount(
                    requiredBatteryKwh,
                    batteryUnitKwh
                )
                : null;

        const batteryVoltage =
            Number(
                options.batteryVoltage ||
                this.settings.defaultBatteryVoltage
            );

        const batteryCurrent =
            this.calculateBatteryCurrent(
                requiredInverterKw,
                batteryVoltage
            );

        return {
            location,
            sunHours,

            dailyEnergyKwh:
                Number(
                    dailyEnergy.toFixed(2)
                ),

            designEnergyKwh:
                Number(
                    designEnergy.toFixed(2)
                ),

            continuousLoadKw:
                Number(
                    (
                        continuousLoad / 1000
                    ).toFixed(2)
                ),

            startingLoadKw:
                Number(
                    (
                        startingLoad / 1000
                    ).toFixed(2)
                ),

            essentialBackupLoadKw:
                Number(
                    (
                        essentialBackupLoad / 1000
                    ).toFixed(2)
                ),

            requiredInverterKw:
                Number(
                    requiredInverterKw.toFixed(2)
                ),
            approximateInverterClassKw:
                approximateInverterClassKw,

            requiredSurgeKw:
                Number(
                    (startingLoad / 1000).toFixed(2)
                ),

            requiredPvKw:
                Number(
                    requiredPvKw.toFixed(2)
                ),

            panelWatts,
            panelCount,

            actualPvKw:
                Number(
                    actualPvKw.toFixed(2)
                ),

            backupHours,

            backupEnergyKwh:
                Number(
                    backupEnergy.toFixed(2)
                ),

            requiredBatteryKwh:
                Number(
                    requiredBatteryKwh.toFixed(2)
                ),

            batteryUnitKwh,
            batteryCount,

            batteryVoltage,

            batteryCurrentA:
                Number(
                    batteryCurrent.toFixed(1)
                )
        };
    }

};
