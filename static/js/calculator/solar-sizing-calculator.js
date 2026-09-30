let applianceRowCount = 0;

function addApplianceRow(
    applianceKey = "tv",
    quantity = 1,
    hours = 4
) {

    const list = document.getElementById("appliance-list");

    const row = document.createElement("div");

    row.className = "calculator-appliance-row";

    row.dataset.rowId = applianceRowCount++;

    row.innerHTML = `
        <select class="appliance-type">
            ${Object.entries(ApplianceDatabase)
                .map(([key, appliance]) =>
                    `<option value="${key}" ${key === applianceKey ? "selected" : ""}>
                        ${appliance.name}
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
                value="${quantity}"
            >
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

        <button
            type="button"
            onclick="this.parentElement.remove()"
        >
            Remove
        </button>
    `;

    list.appendChild(row);
}


function collectAppliances() {

    const rows =
        document.querySelectorAll(".calculator-appliance-row");

    const appliances = [];

    rows.forEach(row => {

        const type =
            row.querySelector(".appliance-type").value;

        const quantity =
            Number(
                row.querySelector(".appliance-quantity").value
            );

        const hours =
            Number(
                row.querySelector(".appliance-hours").value
            );

        const databaseItem =
            ApplianceDatabase[type];

        if (!databaseItem) {
            return;
        }

        appliances.push({

            name: databaseItem.name,

            watts: databaseItem.watts,

            startingWatts:
                databaseItem.startingWatts,

            quantity,

            hours
        });
    });

    return appliances;
}


function calculateSolarSystem() {

    const location =
        document.getElementById("solar-location").value;

    const backupHours =
        Number(
            document.getElementById("backup-hours").value
        );

    const panelWatts =
        Number(
            document.getElementById("panel-watts").value
        );

    const appliances =
        collectAppliances();

    const resultElement =
        document.getElementById("calculator-result");

    if (!appliances.length) {

        resultElement.innerHTML =
            "<p>Please add at least one appliance.</p>";

        return;
    }

    const invalidAppliance =
        appliances.some(
            appliance =>
                appliance.quantity <= 0 ||
                appliance.hours < 0
        );

    if (invalidAppliance) {

        resultElement.innerHTML =
            "<p>Please check appliance quantities and hours.</p>";

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
                ${result.panelCount} × ${result.panelWatts} W
                (${result.actualPvKw} kWp)
            </p>

            <p>
                <strong>Required inverter capacity:</strong>
                ${result.requiredInverterKw} kW
            </p>

            <p>
                <strong>Estimated starting load:</strong>
                ${result.startingLoadKw} kW
            </p>

            <p>
                <strong>Backup requirement:</strong>
                ${result.backupHours} hours
            </p>

            <p>
                <strong>Estimated battery capacity:</strong>
                ${result.requiredBatteryKwh} kWh
            </p>

            <p>
                <strong>Example battery configuration:</strong>
                ${result.batteryCount} × ${result.batteryUnitKwh} kWh
            </p>

            <p>
                <strong>Estimated 48 V battery current:</strong>
                ${result.batteryCurrentA} A
            </p>

            <hr>

            <p>
                This is a preliminary engineering estimate.
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


document.addEventListener("DOMContentLoaded", () => {

    addApplianceRow("tv", 1, 4);
    addApplianceRow("fridge", 1, 8);
    addApplianceRow("lights", 6, 6);
    addApplianceRow("wifi", 1, 24);

});
