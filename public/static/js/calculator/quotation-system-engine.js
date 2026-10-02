const QuotationSystemEngine = {

    version: "1.0.0",
    businessSettings: {

        quotation: {

            confirmationAction:
                "confirm_quotation",

            confirmationMessage:
                "To proceed, confirm the quotation and we will arrange the next stage.",

            confirmationStatus:
                "ready_for_customer_confirmation",

            paymentTerms: {

                deposit: {
                    amount: null,
                    status: "to_be_configured",
                    description:
                        "Initial payment required before the agreed project stage begins."
                },

                progressPayment: {
                    amount: null,
                    status: "to_be_configured",
                    description:
                        "Progress payment according to the agreed quotation and project milestones."
                },

                balance: {
                    amount: null,
                    status: "to_be_configured",
                    description:
                        "Balance payable according to the agreed quotation and completion terms."
                },

                paymentMethod: {
                    value: null,
                    status: "to_be_configured",
                    description:
                        "Accepted payment method to be confirmed in the final quotation."
                },

                conditions: {
                    value: null,
                    status: "to_be_configured",
                    description:
                        "Payment conditions and project-specific terms to be confirmed in the final quotation."
                }

            }

        }

    },


    buildConfigurationExplanation(sizingResult) {

        const explanations = [];

        const dailyEnergy =
            Number(sizingResult.dailyEnergyKwh) || 0;

        const designEnergy =
            Number(sizingResult.designEnergyKwh) || 0;

        const pvKw =
            Number(sizingResult.actualPvKw) || 0;

        const panelCount =
            Number(sizingResult.panelCount) || 0;

        const panelWatts =
            Number(sizingResult.panelWatts) || 0;

        const continuousLoadKw =
            Number(sizingResult.continuousLoadKw) || 0;

        const requiredInverterKw =
            Number(sizingResult.requiredInverterKw) || 0;

        const inverterClassKw =
            sizingResult.approximateInverterClassKw;

        const backupHours =
            Number(sizingResult.backupHours) || 0;

        const requiredBatteryKwh =
            Number(sizingResult.requiredBatteryKwh) || 0;

        const batteryVoltage =
            Number(sizingResult.batteryVoltage) || 0;


        if (dailyEnergy > 0) {
            explanations.push(
                `Your estimated daily energy consumption is approximately ${dailyEnergy.toFixed(2)} kWh per day.`
            );
        }


        if (
            designEnergy > 0 &&
            designEnergy !== dailyEnergy
        ) {
            explanations.push(
                `The system design allows for approximately ${designEnergy.toFixed(2)} kWh per day after applying the design allowance for future load growth.`
            );
        }


        if (
            pvKw > 0 &&
            panelCount > 0 &&
            panelWatts > 0
        ) {
            explanations.push(
                `The recommended solar array is approximately ${pvKw.toFixed(2)} kWp, provided by ${panelCount} x ${panelWatts} W solar panels.`
            );
        }


        if (continuousLoadKw > 0) {
            explanations.push(
                `Your estimated simultaneous running load is approximately ${continuousLoadKw.toFixed(2)} kW.`
            );
        }


        if (requiredInverterKw > 0) {

            if (inverterClassKw) {
                explanations.push(
                    `The calculated minimum inverter requirement is approximately ${requiredInverterKw.toFixed(2)} kW, placing the system in approximately the ${inverterClassKw} kW inverter class, subject to final equipment compatibility and surge requirements.`
                );
            } else {
                explanations.push(
                    `The calculated minimum inverter requirement is approximately ${requiredInverterKw.toFixed(2)} kW and requires equipment selection and engineering review.`
                );
            }
        }


        if (
            backupHours > 0 &&
            requiredBatteryKwh > 0
        ) {
            explanations.push(
                `For approximately ${backupHours} hours of the selected essential-load backup requirement, the calculated nominal battery requirement is approximately ${requiredBatteryKwh.toFixed(2)} kWh.`
            );
        }


        if (batteryVoltage > 0) {
            explanations.push(
                `The preliminary battery architecture uses a ${batteryVoltage} V battery system; final battery selection must satisfy the inverter voltage, discharge-current and protection requirements.`
            );
        }


        return explanations;
    },

    getCatalogueData(catalogue = null) {

        if (
            catalogue &&
            catalogue.data &&
            typeof catalogue.data === "object"
        ) {
            return catalogue.data;
        }

        if (
            catalogue &&
            typeof catalogue === "object" &&
            Array.isArray(catalogue.products) &&
            Array.isArray(catalogue.materials) &&
            Array.isArray(catalogue.services)
        ) {
            return catalogue;
        }

        if (
            typeof QuotationCatalogue !== "undefined" &&
            QuotationCatalogue &&
            QuotationCatalogue.data &&
            typeof QuotationCatalogue.data === "object"
        ) {
            return QuotationCatalogue.data;
        }

        return null;
    },


    findCatalogueItem(
        catalogue,
        collection,
        id
    ) {

        const data =
            this.getCatalogueData(catalogue);

        if (
            !data ||
            !Array.isArray(data[collection]) ||
            !id
        ) {
            return null;
        }

        return (
            data[collection].find(
                item =>
                    item &&
                    item.id === id
            ) || null
        );
    },


    buildCatalogueLine(
        catalogue,
        collection,
        id,
        quantity = 1
    ) {

        const item =
            this.findCatalogueItem(
                catalogue,
                collection,
                id
            );

        if (!item) {
            return null;
        }

        const numericQuantity =
            Number(quantity);

        if (
            !Number.isFinite(numericQuantity) ||
            numericQuantity <= 0
        ) {
            return null;
        }

        const rawSellingPrice =
            item.pricing &&
            item.pricing.sellingPrice;

        const hasConfiguredPrice =
            rawSellingPrice !== null &&
            rawSellingPrice !== undefined &&
            rawSellingPrice !== "" &&
            Number.isFinite(
                Number(rawSellingPrice)
            ) &&
            Number(rawSellingPrice) >= 0;

        const unitPrice =
            hasConfiguredPrice
                ? Number(rawSellingPrice)
                : null;

        const lineTotal =
            hasConfiguredPrice
                ? Number(
                    (
                        numericQuantity *
                        unitPrice
                    ).toFixed(2)
                )
                : null;

        return {

            catalogueId:
                item.id,

            collection:
                collection,

            category:
                item.category || "",

            name:
                item.name || "",

            brand:
                item.brand || "",

            model:
                item.model || "",

            supplier:
                item.supplier || "",

            quantity:
                numericQuantity,

            unit:
                item.unit || "",

            unitPrice:
                unitPrice,

            lineTotal:
                lineTotal,

            pricingStatus:
                hasConfiguredPrice
                    ? "configured"
                    : "price_not_configured",

            availability:
                item.availability || {},

            warranty:
                item.warranty || {},

            source:
                "quotation_catalogue"
        };
    },


    /*
     * Resolve selected catalogue equipment into the technical system
     * before quotation creation.
     *
     * Catalogue selection is not only commercial data. Inverter and
     * battery specifications can affect system compatibility, so the
     * selected specifications must pass the same engineering validator
     * before a quotation is created.
     */
    resolveCatalogueValidation(
        sizingResult,
        catalogueSelections = null,
        catalogue = null
    ) {
        const resolvedSystem = {
            ...sizingResult
        };

        if (
            !catalogueSelections ||
            typeof catalogueSelections !== "object"
        ) {
            return {
                system: resolvedSystem,
                validation: null,
                selected: false
            };
        }

        if (
            !catalogue ||
            typeof catalogue !== "object"
        ) {
            throw new Error(
                "Catalogue selections were supplied without a valid catalogue."
            );
        }

        const findSelectedItem = (
            collectionName,
            category
        ) => {
            const selections =
                catalogueSelections[collectionName];

            if (!Array.isArray(selections)) {
                return null;
            }

            const collection =
                Array.isArray(catalogue[collectionName])
                    ? catalogue[collectionName]
                    : [];

            for (const selection of selections) {
                if (
                    !selection ||
                    typeof selection !== "object"
                ) {
                    continue;
                }

                const selectedId =
                    selection.id ||
                    selection.catalogueId;

                if (!selectedId) {
                    continue;
                }

                const item =
                    collection.find(
                        candidate =>
                            candidate &&
                            candidate.id === selectedId
                    );

                if (!item) {
                    continue;
                }

                const itemCategory =
                    String(
                        item.category || ""
                    ).toLowerCase();

                const targetCategory =
                    String(
                        selection.targetCategory || ""
                    ).toLowerCase();

                if (
                    targetCategory ===
                        category.toLowerCase() ||
                    itemCategory ===
                        category.toLowerCase()
                ) {
                    return item;
                }
            }

            return null;
        };

        const selectedInverter =
            findSelectedItem(
                "products",
                "inverter"
            );

        const selectedBattery =
            findSelectedItem(
                "products",
                "battery"
            );

        const technicalErrors = [];

        if (selectedInverter) {
            const specifications =
                selectedInverter.specifications || {};

            const continuousRatingKw =
                Number(
                    specifications.continuousRatingKw
                );

            const surgeRatingKw =
                Number(
                    specifications.surgeRatingKw
                );

            const maxPvKw =
                Number(
                    specifications.maxPvKw
                );

            if (
                !Number.isFinite(
                    continuousRatingKw
                ) ||
                continuousRatingKw <= 0
            ) {
                technicalErrors.push(
                    `Selected inverter "${selectedInverter.name || selectedInverter.id}" is missing a valid continuous power rating.`
                );
            }

            if (
                !Number.isFinite(
                    surgeRatingKw
                ) ||
                surgeRatingKw <= 0
            ) {
                technicalErrors.push(
                    `Selected inverter "${selectedInverter.name || selectedInverter.id}" is missing a valid surge power rating.`
                );
            }

            if (
                !Number.isFinite(
                    maxPvKw
                ) ||
                maxPvKw <= 0
            ) {
                technicalErrors.push(
                    `Selected inverter "${selectedInverter.name || selectedInverter.id}" is missing a valid maximum PV input rating.`
                );
            }

            resolvedSystem.inverter = {
                ...(
                    resolvedSystem.inverter || {}
                ),
                continuousRatingKw,
                surgeRatingKw,
                maxPvKw
            };
        }

        if (selectedBattery) {
            const specifications =
                selectedBattery.specifications || {};

            const nominalVoltage =
                Number(
                    specifications.nominalVoltage
                );

            const maxChargeKw =
                Number(
                    specifications.maxChargeKw
                );

            const maxChargeA =
                Number(
                    specifications.maxChargeA
                );

            const unitKwh =
                Number(
                    specifications.unitKwh
                );

            if (
                !Number.isFinite(
                    nominalVoltage
                ) ||
                nominalVoltage <= 0
            ) {
                technicalErrors.push(
                    `Selected battery "${selectedBattery.name || selectedBattery.id}" is missing a valid nominal voltage.`
                );
            }

            if (
                !Number.isFinite(
                    maxChargeKw
                ) ||
                maxChargeKw <= 0
            ) {
                technicalErrors.push(
                    `Selected battery "${selectedBattery.name || selectedBattery.id}" is missing a valid maximum charging power.`
                );
            }

            if (
                !Number.isFinite(
                    maxChargeA
                ) ||
                maxChargeA <= 0
            ) {
                technicalErrors.push(
                    `Selected battery "${selectedBattery.name || selectedBattery.id}" is missing a valid maximum charging current.`
                );
            }

            if (
                !Number.isFinite(
                    unitKwh
                ) ||
                unitKwh <= 0
            ) {
                technicalErrors.push(
                    `Selected battery "${selectedBattery.name || selectedBattery.id}" is missing a valid unit capacity.`
                );
            }

            resolvedSystem.battery = {
                ...(
                    resolvedSystem.battery || {}
                ),
                nominalVoltage,
                maxChargeKw,
                maxChargeA
            };

            resolvedSystem.batteryUnitKwh =
                unitKwh;

            if (
                resolvedSystem.requiredBatteryKwh &&
                unitKwh > 0
            ) {
                resolvedSystem.batteryCount =
                    Math.ceil(
                        resolvedSystem.requiredBatteryKwh /
                        unitKwh
                    );
            }
        }

        if (technicalErrors.length) {
            return {
                system: resolvedSystem,
                validation: {
                    valid: false,
                    errors: technicalErrors,
                    warnings: []
                },
                selected: Boolean(
                    selectedInverter ||
                    selectedBattery
                )
            };
        }

        if (
            typeof SolarSizingEngine ===
                "undefined" ||
            typeof SolarSizingEngine.validateSystem !==
                "function"
        ) {
            throw new Error(
                "SolarSizingEngine validation is required when catalogue equipment is selected."
            );
        }

        const selectedPvKw =
            Number(
                resolvedSystem.selectedPvKw ??
                resolvedSystem.actualPvKw
            ) || 0;

        const pvChargePowerKw =
            Number(
                resolvedSystem.pvChargePowerKw ??
                resolvedSystem.requiredPvKw
            ) || 0;

        const batteryChargeCurrent =
            Number(
                resolvedSystem.batteryChargeCurrent ??
                resolvedSystem.batteryCurrentA
            ) || 0;

        resolvedSystem.selectedPvKw =
            selectedPvKw;

        resolvedSystem.pvChargePowerKw =
            pvChargePowerKw;

        resolvedSystem.batteryChargeCurrent =
            batteryChargeCurrent;

        const validation =
            SolarSizingEngine.validateSystem(
                resolvedSystem
            );

        return {
            system: resolvedSystem,
            validation,
            selected: Boolean(
                selectedInverter ||
                selectedBattery
            )
        };
    },


    buildEquipmentBOM(
        sizingResult,
        catalogueSelections = null,
        catalogue = null
    ) {

        const equipment = [];

        /*
         * Build the engineering BOM first.
         *
         * This remains the authoritative technical requirement.
         * Catalogue selections may replace matching lines, but they
         * must never remove an engineering requirement simply because
         * a catalogue item has not yet been selected.
         */

        const panelCount =
            Number(sizingResult.panelCount) || 0;

        const panelWatts =
            Number(sizingResult.panelWatts) || 0;

        const pvKw =
            Number(sizingResult.actualPvKw) || 0;

        const inverterClassKw =
            sizingResult.approximateInverterClassKw;

        const inverterRequiredKw =
            Number(
                sizingResult.requiredInverterKw
            ) || 0;

        const requiredBatteryKwh =
            Number(
                sizingResult.requiredBatteryKwh
            ) || 0;

        const batteryCount =
            sizingResult.batteryCount ??
            null;

        const batteryUnitKwh =
            sizingResult.batteryUnitKwh ??
            null;

        const batteryVoltage =
            sizingResult.batteryVoltage ??
            null;


        if (
            panelCount > 0 &&
            panelWatts > 0
        ) {

            equipment.push({

                category: "Solar PV",

                item: "solar panels",

                quantity:
                    panelCount,

                unit: "panel",

                specification:
                    `${panelWatts} W each`,

                calculatedCapacityKw:
                    Number(
                        pvKw.toFixed(2)
                    ),

                status: "calculated"
            });
        }


        if (inverterRequiredKw > 0) {

            equipment.push({

                category: "Inverter",

                item: "Hybrid inverter",

                quantity: 1,

                unit: "unit",

                specification:
                    inverterClassKw
                        ? `${inverterClassKw} kW class; calculated minimum requirement ${inverterRequiredKw.toFixed(2)} kW`
                        : `Calculated minimum requirement ${inverterRequiredKw.toFixed(2)} kW; engineering review required`,

                status:
                    "requires_equipment_selection"
            });
        }


        if (requiredBatteryKwh > 0) {

            equipment.push({

                category: "Battery",

                item: "Lithium battery storage",

                quantity:
                    batteryCount,

                unit:
                    batteryCount
                        ? "unit"
                        : "product-dependent",

                specification:
                    batteryUnitKwh
                        ? `${batteryUnitKwh} kWh each; ${requiredBatteryKwh.toFixed(2)} kWh required`
                        : `${requiredBatteryKwh.toFixed(2)} kWh nominal capacity required`,

                batteryVoltage:
                    batteryVoltage,

                status:
                    batteryCount
                        ? "calculated"
                        : "requires_battery_selection"
            });
        }


        equipment.push({

            category: "Mounting",

            item:
                "Solar panel mounting structure",

            quantity: null,

            unit: "system",

            specification:
                "Sized for the selected solar panels and installation surface.",

            status:
                "site_selection_required"
        });


        equipment.push({

            category: "DC Protection",

            item:
                "PV DC protection and isolation",

            quantity: null,

            unit: "set",

            specification:
                "Final specification to match PV array, inverter and string configuration.",

            status:
                "engineering_selection_required"
        });


        equipment.push({

            category: "AC Protection",

            item:
                "AC protection and isolation",

            quantity: null,

            unit: "set",

            specification:
                "Final specification to match inverter output and installation requirements.",

            status:
                "engineering_selection_required"
        });


        equipment.push({

            category: "Cabling",

            item:
                "Solar PV cables and connectors",

            quantity: null,

            unit: "lot",

            specification:
                "Final lengths and sizes depend on site layout and selected equipment.",

            status:
                "site_measurement_required"
        });


        equipment.push({

            category: "Battery Cabling",

            item:
                "Battery cables and protection",

            quantity: null,

            unit: "set",

            specification:
                "Final cable size and protection depend on battery/inverter current and installation layout.",

            status:
                "engineering_selection_required"
        });


        equipment.push({

            category: "Earthing",

            item:
                "Earthing and bonding",

            quantity: null,

            unit: "lot",

            specification:
                "To be completed according to the final installation and applicable electrical requirements.",

            status:
                "site_selection_required"
        });


        equipment.push({

            category: "Installation",

            item:
                "Installation, testing and commissioning",

            quantity: 1,

            unit: "service",

            specification:
                "Complete installation, testing and commissioning of the selected system.",

            status:
                "service"
        });


        /*
         * Catalogue selections are an overlay on the engineering BOM.
         *
         * A valid catalogue item replaces the matching engineering
         * category. Unselected engineering categories remain present.
         */

        if (
            catalogueSelections &&
            typeof catalogueSelections === "object"
        ) {

            const categoryMap = {

                solar_panel:
                    "Solar PV",

                inverter:
                    "Inverter",

                battery:
                    "Battery",

                mounting:
                    "Mounting",

                dc_protection:
                    "DC Protection",

                ac_protection:
                    "AC Protection",

                cabling:
                    "Cabling",

                battery_cabling:
                    "Battery Cabling",

                earthing:
                    "Earthing",

                installation:
                    "Installation"
            };


            const collections = [
                {
                    key: "products",
                    collection: "products"
                },
                {
                    key: "materials",
                    collection: "materials"
                },
                {
                    key: "services",
                    collection: "services"
                }
            ];


            for (const definition of collections) {

                const selections =
                    catalogueSelections[
                        definition.key
                    ];


                if (!Array.isArray(selections)) {
                    continue;
                }


                for (const selection of selections) {

                    if (
                        !selection ||
                        typeof selection !== "object"
                    ) {
                        continue;
                    }


                    const catalogueId =
                        selection.id ||
                        selection.catalogueId;


                    const quantity =
                        selection.quantity ?? 1;


                    const line =
                        this.buildCatalogueLine(
                            catalogue,
                            definition.collection,
                            catalogueId,
                            quantity
                        );


                    if (!line) {

                        equipment.push({

                            category:
                                definition.key,

                            item:
                                catalogueId || "",

                            quantity:
                                Number(quantity) || null,

                            unit:
                                "",

                            specification:
                                "Selected catalogue item could not be found or has an invalid quantity.",

                            status:
                                "catalogue_selection_invalid",

                            catalogueId:
                                catalogueId || null
                        });

                        continue;
                    }


                    const catalogueCategory =
                        String(
                            line.category || ""
                        ).toLowerCase();


                    const targetCategory =
                        selection.targetCategory ||
                        categoryMap[catalogueCategory] ||
                        null;


                    const selectedLine = {

                        category:
                            targetCategory ||
                            definition.key,

                        item:
                            line.name,

                        quantity:
                            line.quantity,

                        unit:
                            line.unit,

                        specification:
                            [
                                line.brand,
                                line.model
                            ]
                                .filter(Boolean)
                                .join(" ") ||
                            "Catalogue item",

                        catalogueId:
                            line.catalogueId,

                        supplier:
                            line.supplier,

                        unitPrice:
                            line.unitPrice,

                        lineTotal:
                            line.lineTotal,

                        pricingStatus:
                            line.pricingStatus,

                        availability:
                            line.availability,

                        warranty:
                            line.warranty,

                        status:
                            "catalogue_selected",

                        source:
                            line.source
                    };


                    if (targetCategory) {

                        const engineeringIndex =
                            equipment.findIndex(
                                item =>
                                    item.category ===
                                    targetCategory
                            );


                        if (engineeringIndex >= 0) {

                            equipment[
                                engineeringIndex
                            ] = selectedLine;

                        } else {

                            equipment.push(
                                selectedLine
                            );
                        }

                    } else {

                        /*
                         * Unknown catalogue categories are retained
                         * rather than silently discarded.
                         */

                        equipment.push(
                            selectedLine
                        );
                    }
                }
            }
        }


        return equipment;
    },

    buildExpectedUse(sizingResult) {

        const expectedUse = [];

        const backupHours =
            Number(sizingResult.backupHours) || 0;

        const essentialLoadKw =
            Number(
                sizingResult.essentialBackupLoadKw
            ) || 0;

        const dailyEnergyKwh =
            Number(
                sizingResult.dailyEnergyKwh
            ) || 0;

        const designEnergyKwh =
            Number(
                sizingResult.designEnergyKwh
            ) || 0;


        if (dailyEnergyKwh > 0) {
            expectedUse.push(
                `The system is sized around an estimated daily energy requirement of approximately ${dailyEnergyKwh.toFixed(2)} kWh per day.`
            );
        }


        if (
            designEnergyKwh > 0 &&
            designEnergyKwh !== dailyEnergyKwh
        ) {
            expectedUse.push(
                `The PV design uses approximately ${designEnergyKwh.toFixed(2)} kWh per day as the design energy requirement, including the configured future-load allowance.`
            );
        }


        if (essentialLoadKw > 0) {
            expectedUse.push(
                `During backup operation, the battery sizing is based on an estimated essential-load demand of approximately ${essentialLoadKw.toFixed(2)} kW.`
            );
        }


        if (backupHours > 0) {
            expectedUse.push(
                `The calculated battery requirement is intended to provide approximately ${backupHours} hours of backup for the selected essential loads under the sizing assumptions.`
            );
        }


        expectedUse.push(
            "The actual appliances that can operate during backup depend on the loads selected as essential and the simultaneous power demand at the time."
        );


        expectedUse.push(
            "High-power appliances or additional loads may reduce the available backup duration and should be assessed before being included in the backup circuit."
        );


        expectedUse.push(
            "Final equipment selection and system validation are required before the quotation is treated as an installation-ready system."
        );


        return expectedUse;
    },

    buildWarrantyPolicy() {

        return [

            {
                category: "solar panels",
                warrantyType: "manufacturer",
                period: null,
                status: "to_be_confirmed",
                terms:
                    "Warranty period and conditions to be confirmed from the selected solar panel manufacturer's warranty."
            },

            {
                category: "Inverter",
                warrantyType: "manufacturer",
                period: null,
                status: "to_be_confirmed",
                terms:
                    "Warranty period and conditions to be confirmed from the selected inverter manufacturer's warranty."
            },

            {
                category: "Battery",
                warrantyType: "manufacturer",
                period: null,
                status: "to_be_confirmed",
                terms:
                    "Warranty period and conditions to be confirmed from the selected battery manufacturer's warranty."
            },

            {
                category: "Installation",
                warrantyType: "workmanship",
                period: null,
                status: "business_policy_required",
                terms:
                    "Installation workmanship warranty is subject to Brian Solar & Electrical's applicable workmanship policy."
            },

            {
                category: "General",
                warrantyType: "conditions",
                period: null,
                status: "standard_conditions",
                terms:
                    "Warranty coverage is subject to the applicable manufacturer's terms, installation conditions, proper system use and the final equipment supplied."
            }

        ];
    },

        buildPricingSummary(

            equipment = [],

            pricingOptions = {}

        ) {



            const safeEquipment =

                Array.isArray(equipment)

                    ? equipment

                    : [];



            const safeOptions =

                pricingOptions &&

                typeof pricingOptions === "object"

                    ? pricingOptions

                    : {};



            const currency =

                safeOptions.currency ||

                "KES";



            const discount =

                Number(

                    safeOptions.discount

                );



            const tax =

                Number(

                    safeOptions.tax

                );



            const configuredDiscount =

                Number.isFinite(discount) &&

                discount >= 0

                    ? discount

                    : 0;



            const configuredTax =

                Number.isFinite(tax) &&

                tax >= 0

                    ? tax

                    : 0;



            const lines = [];



            let subtotal = 0;

            let unpricedLineCount = 0;

            let invalidPriceCount = 0;

            let invalidQuantityCount = 0;



            for (const item of safeEquipment) {



                if (

                    !item ||

                    typeof item !== "object"

                ) {

                    continue;

                }



                const quantity =

                    Number(item.quantity);



                const unitPrice =

                    item.unitPrice;



                const hasValidQuantity =

                    Number.isFinite(quantity) &&

                    quantity > 0;



                const hasConfiguredPrice =

                    unitPrice !== null &&

                    unitPrice !== undefined &&

                    unitPrice !== "" &&

                    Number.isFinite(

                        Number(unitPrice)

                    ) &&

                    Number(unitPrice) >= 0;



                const hasInvalidPrice =

                    unitPrice !== null &&

                    unitPrice !== undefined &&

                    unitPrice !== "" &&

                    !hasConfiguredPrice;



                let lineTotal = null;



                if (

                    hasValidQuantity &&

                    hasConfiguredPrice

                ) {



                    lineTotal =

                        Number(

                            (

                                quantity *

                                Number(unitPrice)

                            ).toFixed(2)

                        );



                    subtotal += lineTotal;

                }



                if (!hasValidQuantity) {

                    invalidQuantityCount++;

                }



                if (hasInvalidPrice) {

                    invalidPriceCount++;

                }



                if (

                    !hasConfiguredPrice ||

                    !hasValidQuantity

                ) {

                    unpricedLineCount++;

                }



                lines.push({



                    category:

                        item.category || "",



                    item:

                        item.item || "",



                    catalogueId:

                        item.catalogueId || null,



                    quantity:

                        hasValidQuantity

                            ? quantity

                            : null,



                    unit:

                        item.unit || "",



                    unitPrice:

                        hasConfiguredPrice

                            ? Number(unitPrice)

                            : null,



                    lineTotal:

                        lineTotal,



                    pricingStatus:

                        hasConfiguredPrice &&

                        hasValidQuantity

                            ? "configured"

                            : "price_not_configured"

                });

            }



            const discountAmount =

                Number(

                    Math.min(

                        configuredDiscount,

                        subtotal

                    ).toFixed(2)

                );



            const taxableAmount =

                Number(

                    Math.max(

                        0,

                        subtotal - discountAmount

                    ).toFixed(2)

                );



            const taxAmount =

                Number(

                    (

                        taxableAmount *

                        configuredTax /

                        100

                    ).toFixed(2)

                );



            const total =

                Number(

                    (

                        taxableAmount +

                        taxAmount

                    ).toFixed(2)

                );



            const hasUnpricedLines =

                unpricedLineCount > 0;



            return {



                currency,



                lines,



                subtotal:

                    Number(

                        subtotal.toFixed(2)

                    ),



                discount:

                    discountAmount,



                taxRate:

                    configuredTax,



                tax:

                    taxAmount,



                total,



                unpricedLineCount,



                invalidPriceCount,





                invalidQuantityCount,

                status:

                    hasUnpricedLines

                        ? "pricing_incomplete"

                        : "fully_configured",



                priceConfigured:

                    !hasUnpricedLines

            };

        },


    createQuotation(
        sizingResult,
        customer = {},
        validationResult = null,
        catalogueOptions = {}
    ) {

        if (!sizingResult) {
            throw new Error(
                "A solar sizing result is required."
            );
        }


        if (!validationResult) {
            throw new Error(
                "A system validation result is required before creating a quotation."
            );
        }


        if (validationResult.valid !== true) {

            const validationErrors =
                Array.isArray(validationResult.errors)
                    ? validationResult.errors
                    : [];


            throw new Error(
                "Quotation cannot be created because the solar system failed validation." +
                (
                    validationErrors.length
                        ? " " + validationErrors.join(" ")
                        : ""
                )
            );
        }


        /*
         * Catalogue integration
         *
         * Catalogue selections are optional.
         * Technical sizing and validation remain independent
         * from commercial product selection.
         */

        const safeCatalogueOptions =
            catalogueOptions &&
            typeof catalogueOptions === "object"
                ? catalogueOptions
                : {};


        const catalogueSelections =
            safeCatalogueOptions.catalogueSelections
                ?? null;


        const catalogue =
            safeCatalogueOptions.catalogue
                ?? null;


        /*
         * Resolve selected catalogue equipment into the technical
         * system before building the quotation.
         *
         * Catalogue inverter and battery specifications can affect
         * system compatibility, so selected equipment must pass
         * engineering validation before quotation creation.
         */
        const catalogueResolution =
            this.resolveCatalogueValidation(
                sizingResult,
                catalogueSelections,
                catalogue
            );

        if (
            catalogueResolution.validation &&
            catalogueResolution.validation.valid !== true
        ) {
            const compatibilityErrors =
                Array.isArray(
                    catalogueResolution.validation.errors
                )
                    ? catalogueResolution.validation.errors
                    : [];

            throw new Error(
                "Quotation cannot be created because the selected catalogue equipment failed system compatibility validation." +
                (
                    compatibilityErrors.length
                        ? " " + compatibilityErrors.join(" ")
                        : ""
                )
            );
        }

        const resolvedSizingResult =
            catalogueResolution.system;

        const equipment =
            this.buildEquipmentBOM(
                resolvedSizingResult,
                catalogueSelections,
                catalogue
            );
        const pricingSummary =
            this.buildPricingSummary(
                equipment,
                safeCatalogueOptions.pricing
            );

        const quotationStatus =
            pricingSummary.priceConfigured
                ? "ready_for_customer_confirmation"
                : "pricing_incomplete";

        const nextStepStatus =
            pricingSummary.priceConfigured
                ? this.businessSettings
                    .quotation
                    .confirmationStatus
                : "pricing_requires_configuration";

        const nextStepAction =
            pricingSummary.priceConfigured
                ? this.businessSettings
                    .quotation
                    .confirmationAction
                : "complete_quotation_pricing";

        const nextStepMessage =
            pricingSummary.priceConfigured
                ? this.businessSettings
                    .quotation
                    .confirmationMessage
                : "Pricing is incomplete. Complete the equipment selection and pricing before confirming the quotation.";



        return {

            quotation: {
                number: null,
                date: new Date().toISOString(),
                status: quotationStatus
            },


            customer: {
                name: customer.name || "",
                phone: customer.phone || "",
                email: customer.email || "",
                location: customer.location || ""
            },


            requirement: {
                dailyEnergyKwh:
                    Number(
                        resolvedSizingResult.dailyEnergyKwh
                    ) || 0,

                designEnergyKwh:
                    Number(
                        resolvedSizingResult.designEnergyKwh
                    ) || 0,

                backupHours:
                    Number(
                        resolvedSizingResult.backupHours
                    ) || 0,

                backupEnergyKwh:
                    Number(
                        resolvedSizingResult.requiredBatteryKwh
                    ) || 0,

                continuousLoadKw:
                    Number(
                        resolvedSizingResult.continuousLoadKw
                    ) || 0,

                startingLoadKw:
                    Number(
                        resolvedSizingResult.startingLoadKw
                    ) || 0
            },


            recommendation: {
                pvKw:
                    Number(
                        resolvedSizingResult.actualPvKw
                    ) || 0,

                panelWatts:
                    Number(
                        resolvedSizingResult.panelWatts
                    ) || 0,

                panelCount:
                    Number(
                        resolvedSizingResult.panelCount
                    ) || 0,

                inverterRequiredKw:
                    Number(
                        resolvedSizingResult.requiredInverterKw
                    ) || 0,

                inverterClassKw:
                    resolvedSizingResult
                        .approximateInverterClassKw
                        ?? null,

                batteryRequiredKwh:
                    Number(
                        resolvedSizingResult.requiredBatteryKwh
                    ) || 0,

                batteryCount:
                    resolvedSizingResult.batteryCount
                        ?? null,

                batteryUnitKwh:
                    resolvedSizingResult.batteryUnitKwh
                        ?? null,

                batteryVoltage:
                    resolvedSizingResult.batteryVoltage
                        ?? null
            },


            whyThisConfiguration:
                this.buildConfigurationExplanation(
                    resolvedSizingResult
                ),


            equipment:
                equipment,


            expectedUse:
                this.buildExpectedUse(
                    resolvedSizingResult
                ),


            warranties:
                this.buildWarrantyPolicy(),


            paymentTerms:
                this.businessSettings
                    .quotation
                    .paymentTerms,

            pricing:
                pricingSummary,

            nextStep: {
                action:
                    nextStepAction,

                message:
                    nextStepMessage,

                status:
                    nextStepStatus
            }
        };
    }


};
