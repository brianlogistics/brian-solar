let applianceRowCount = 0;

function addApplianceRow(
    applianceKey = "tv",
    quantity = 1,
    hours = 4,
    essential = false,
    peakQuantity = quantity,
    startingQuantity = 0
) {
    const list =
        document.getElementById("appliance-list");

    const row =
        document.createElement("div");

    row.className =
        "calculator-appliance-row";

    row.dataset.rowId =
        applianceRowCount++;

    const appliance =
        ApplianceDatabase[applianceKey];

    row.innerHTML = `
        <select class="appliance-type">
            ${Object.entries(ApplianceDatabase)
                .map(([key, item]) =>
                    `<option value="${key}" ${key === applianceKey ? "selected" : ""}>
                        ${item.name}
                    </option>`
                )
                .join("")}
        </select>

        <label>
            Qty
            <input
                class="appliance-quantity"
                type="number"
                min="1"
                step="1"
                value="${quantity}"
            >
        </label>

        <label>
            Running watts
            <input
                class="appliance-watts"
                type="number"
                min="1"
                step="1"
                value="${appliance.watts}"
                placeholder="Enter W"
            >
            <small>
                Default estimate. Adjust to the actual appliance rating if known.
            </small>
        </label>

        <label>
            Hours/day
            <input
                class="appliance-hours"
                type="number"
                min="0"
                max="24"
                step="0.5"
                value="${hours}"
            >
        </label>

        <label>
            Peak qty
            <input
                class="appliance-peak-quantity"
                type="number"
                min="0"
                step="1"
                value="${peakQuantity}"
            >
            <small>
                Maximum units running at once
            </small>
        </label>

        <label>
            Starting watts
            <input
                class="appliance-starting-watts"
                type="number"
                min="0"
                step="1"
                value="${appliance.startingWatts ?? ""}"
                placeholder="If known"
            >
            <small>
                Default estimate if available. Adjust if the actual starting load is known.
            </small>
        </label>

        <label>
            Starting qty
            <input
                class="appliance-starting-quantity"
                type="number"
                min="0"
                step="1"
                value="${startingQuantity}"
            >
            <small>
                Units starting at the same time
            </small>
        </label>

        <label>
            <input
                class="appliance-essential"
                type="checkbox"
                ${essential ? "checked" : ""}
            >
            Essential for backup
        </label>

        <button
            type="button"
            onclick="this.parentElement.remove()"
        >
            Remove
        </button>
    `;

    list.appendChild(row);

    const typeSelect =
        row.querySelector(".appliance-type");

    typeSelect.addEventListener(
        "change",
        () => {
            const selected =
                ApplianceDatabase[typeSelect.value];

            if (!selected) return;

            const wattsInput =
                row.querySelector(".appliance-watts");

            const startingWattsInput =
                row.querySelector(
                    ".appliance-starting-watts"
                );

            wattsInput.value =
                selected.watts;

            startingWattsInput.value =
                selected.startingWatts ?? "";
        }
    );
}

function collectAppliances() {
    const rows =
        document.querySelectorAll(
            ".calculator-appliance-row"
        );

    const appliances = [];

    rows.forEach(row => {
        const type =
            row.querySelector(
                ".appliance-type"
            ).value;

        const quantity =
            Number(
                row.querySelector(
                    ".appliance-quantity"
                ).value
            );

        const wattsValue =
            row.querySelector(
                ".appliance-watts"
            ).value.trim();

        const watts =
            wattsValue === ""
                ? NaN
                : Number(wattsValue);

        const hours =
            Number(
                row.querySelector(
                    ".appliance-hours"
                ).value
            );

        const peakQuantity =
            Number(
                row.querySelector(
                    ".appliance-peak-quantity"
                ).value
            );

        const startingWattsValue =
            row.querySelector(
                ".appliance-starting-watts"
            ).value.trim();

        const startingWatts =
            startingWattsValue === ""
                ? null
                : Number(startingWattsValue);

        const startingQuantity =
            Number(
                row.querySelector(
                    ".appliance-starting-quantity"
                ).value
            );

        const essential =
            row.querySelector(
                ".appliance-essential"
            ).checked;

        const databaseItem =
            ApplianceDatabase[type];

        if (!databaseItem) return;

        appliances.push({
            name: databaseItem.name,
            watts,
            startingWatts,
            quantity,
            hours,
            peakQuantity,
            startingQuantity,
            essential
        });
    });

    return appliances;
}

function calculateSolarSystem() {
    const location =
        document.getElementById(
            "solar-location"
        ).value;

    const backupHours =
        Number(
            document.getElementById(
                "backup-hours"
            ).value
        );

    const panelWatts =
        Number(
            document.getElementById(
                "panel-watts"
            ).value
        );

    const appliances =
        collectAppliances();

    const resultElement =
        document.getElementById(
            "calculator-result"
        );

    if (!appliances.length) {
        resultElement.innerHTML =
            "<p>Please add at least one appliance.</p>";

        return;
    }

    const invalidAppliance =
        appliances.some(
            appliance =>
                !Number.isFinite(appliance.quantity) ||
                !Number.isFinite(appliance.watts) ||
                !Number.isFinite(appliance.hours) ||
                !Number.isFinite(appliance.peakQuantity) ||
                !Number.isFinite(appliance.startingQuantity) ||
                appliance.quantity < 1 ||
                appliance.watts <= 0 ||
                appliance.hours < 0 ||
                appliance.hours > 24 ||
                appliance.peakQuantity < 0 ||
                appliance.peakQuantity > appliance.quantity ||
                appliance.startingQuantity < 0 ||
                appliance.startingQuantity > appliance.peakQuantity ||
                (
                    appliance.startingWatts !== null &&
                    (
                        !Number.isFinite(appliance.startingWatts) ||
                        appliance.startingWatts <= 0
                    )
                )
        );

    if (invalidAppliance) {
        resultElement.innerHTML = `
            <p>
                Please enter valid appliance data.
                Running watts are required.
                Starting watts are optional.
                Peak quantity cannot exceed total quantity,
                and starting quantity cannot exceed peak quantity.
            </p>
        `;

        return;
    }

    const essentialAppliances =
        appliances.filter(
            appliance => appliance.essential
        );

    if (!essentialAppliances.length) {
        resultElement.innerHTML = `
            <p>
                Please select at least one appliance as
                <strong>Essential for backup</strong>.
            </p>
        `;

        return;
    }

    const result =
        SolarSizingEngine.calculate(
            appliances,
            {
                location,
                backupHours,
                panelWatts
            }
        );

    resultElement.innerHTML = `
        <section class="calculator-results">
            <h2>Estimated Solar System</h2>

            <p>
                <strong>Location:</strong>
                ${result.location}
            </p>

            <p>
                <strong>Estimated daily consumption:</strong>
                ${result.dailyEnergyKwh} kWh/day
            </p>

            <p>
                <strong>Recommended solar PV:</strong>
                ${result.requiredPvKw} kWp
            </p>

            <p>
                <strong>Solar panels:</strong>
                ${result.panelCount} ×
                ${result.panelWatts} W
                (${result.actualPvKw} kWp)
            </p>

            <p>
                <strong>Calculated inverter requirement:</strong>
                ${result.requiredInverterKw} kW minimum
            </p>

            <p>
                <strong>Approximate inverter class:</strong>
                ${result.approximateInverterClassKw !== null
                    ? `${result.approximateInverterClassKw} kW class`
                    : "Engineering review required"}
            </p>

            <p>
                <strong>Calculated starting load:</strong>
                ${result.startingLoadKw} kW
            </p>

            <p>
                <strong>Inverter selection note:</strong>
                The final inverter must also pass continuous-load,
                surge, PV input, MPPT voltage/current, and battery
                compatibility checks against the selected equipment.
            </p>

            <p>
                <strong>Essential backup load:</strong>
                ${result.essentialBackupLoadKw} kW
            </p>

            <p>
                <strong>Backup requirement:</strong>
                ${result.backupHours} hours
            </p>

            <p>
                <strong>Essential backup energy:</strong>
                ${result.backupEnergyKwh} kWh
            </p>

            <p>
                <strong>Estimated battery capacity:</strong>
                ${result.requiredBatteryKwh} kWh
            </p>

            <p>
                <strong>Battery configuration:</strong>
                ${result.batteryUnitKwh !== null && result.batteryCount !== null
                    ? `${result.batteryCount} × ${result.batteryUnitKwh} kWh`
                    : "Select a battery product to calculate the required battery count."}
            </p>

            <p>
                <strong>Estimated battery-side current:</strong>
                ${result.batteryCurrentA} A at ${result.batteryVoltage} V
            </p>

            <hr>

            <p>
                This is a preliminary engineering estimate.
                Daily energy uses the full appliance quantity.
                Inverter sizing uses the specified peak quantity.
                Starting watts are used only when supplied.
                Battery backup sizing uses only appliances marked
                <strong>Essential for backup</strong>.
                Final sizing requires site assessment, actual appliance
                measurements, battery specifications, inverter specifications,
                MPPT voltage/current checks and system compatibility validation.
            </p>

            <p>
                <strong>
                    Contact Brian Solar & Electrical for a detailed quotation.
                </strong>
            </p>
        </section>
    `;
}

document.addEventListener(
    "DOMContentLoaded",
    () => {
        addApplianceRow(
            "tv",
            1,
            4,
            false,
            1,
            0
        );

        addApplianceRow(
            "fridge",
            1,
            8,
            true,
            1,
            0
        );

        addApplianceRow(
            "lights",
            6,
            6,
            true,
            6,
            0
        );

        addApplianceRow(
            "wifi",
            1,
            24,
            true,
            1,
            0
        );
    }
);
