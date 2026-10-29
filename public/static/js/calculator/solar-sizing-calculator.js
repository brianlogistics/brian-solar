let applianceRowCount = 0;

function addApplianceRow(applianceKey = "tv", quantity = 1, hours = 4) {
    const list = document.getElementById("appliance-list");
    if (!list) throw new Error("Appliance list was not found.");

    const preset = ApplianceDatabase[applianceKey];
    const row = document.createElement("div");
    row.className = "calculator-appliance-row";
    row.dataset.rowId = applianceRowCount++;

    const options = Object.entries(ApplianceDatabase)
        .map(([key, appliance]) =>
            `<option value="${key}" ${key === applianceKey ? "selected" : ""}>${appliance.name}</option>`
        ).join("");

    row.innerHTML = `
        <label>Appliance preset
            <select class="appliance-type" onchange="updateAppliancePreset(this)">
                ${options}
                <option value="custom" ${preset ? "" : "selected"}>Custom appliance</option>
            </select>
        </label>
        <label>Appliance name
            <input class="appliance-name" type="text" maxlength="100"
                value="${preset ? preset.name : ""}" placeholder="e.g. 43-inch LED television" required>
        </label>
        <label>Running power (W)
            <input class="appliance-watts" type="number" min="0.1" step="any"
                value="${preset ? preset.watts : ""}" placeholder="From rating label" required>
        </label>
        <label>Starting power (W)
            <input class="appliance-starting-watts" type="number" min="0.1" step="any"
                value="${preset ? preset.startingWatts : ""}" placeholder="Leave blank if unknown; verify surge rating">
        </label>
        <label>Quantity
            <input class="appliance-quantity" type="number" min="1" step="1"
                value="${quantity}" required>
        </label>
        <label>Hours/day
            <input class="appliance-hours" type="number" min="0" max="24" step="0.5"
                value="${hours}" required>
        </label>
        <button type="button" onclick="this.parentElement.remove()">Remove</button>
    `;
    list.appendChild(row);
}

function updateAppliancePreset(select) {
    const row = select.closest(".calculator-appliance-row");
    if (!row) return;

    const preset = ApplianceDatabase[select.value];
    row.querySelector(".appliance-name").value = preset ? preset.name : "";
    row.querySelector(".appliance-watts").value = preset ? preset.watts : "";
    row.querySelector(".appliance-starting-watts").value = preset ? preset.startingWatts : "";
}

function collectAppliances() {
    const rows = document.querySelectorAll(".calculator-appliance-row");
    return Array.from(rows, row => {
        const name = row.querySelector(".appliance-name").value.trim();
        const wattsInput = row.querySelector(".appliance-watts").value.trim();
        const startingInput = row.querySelector(".appliance-starting-watts").value.trim();
        const quantityInput = row.querySelector(".appliance-quantity").value.trim();
        const hoursInput = row.querySelector(".appliance-hours").value.trim();

        return {
            name,
            watts: wattsInput === "" ? NaN : Number(wattsInput),
            startingWatts: startingInput === "" ? null : Number(startingInput),
            quantity: quantityInput === "" ? NaN : Number(quantityInput),
            hours: hoursInput === "" ? NaN : Number(hoursInput)
        };
    });
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



    const batterySelect = document.getElementById("battery-unit-kwh");
    const customBatteryInput = document.getElementById("custom-battery-unit-kwh");
    const batteryUnitKwh = batterySelect.value === "custom"
        ? Number(customBatteryInput.value)
        : Number(batterySelect.value);

    const appliances =
        collectAppliances();

    const resultElement =
        document.getElementById("calculator-result");

    if (!Number.isFinite(backupHours) || backupHours < 0 ||
        !Number.isFinite(panelWatts) || panelWatts <= 0 ||
        !Number.isFinite(batteryUnitKwh) || batteryUnitKwh <= 0) {
        resultElement.textContent =
            "Please select valid backup hours, panel size, and battery capacity.";
        return;
    }

    if (!appliances.length) {

        resultElement.innerHTML =
            "<p>Please add at least one appliance.</p>";

        return;
    }

    const invalidAppliance = appliances.some(appliance =>
        typeof appliance.name !== "string" ||
        appliance.name.trim() === "" ||
        !Number.isFinite(appliance.watts) ||
        appliance.watts <= 0 ||
        appliance.startingWatts !== null && (!Number.isFinite(appliance.startingWatts) || appliance.startingWatts <= 0) ||
        !Number.isFinite(appliance.quantity) ||
        !Number.isInteger(appliance.quantity) ||
        appliance.quantity <= 0 ||
        !Number.isFinite(appliance.hours) ||
        appliance.hours < 0 ||
        appliance.hours > 24
    );

    if (invalidAppliance) {
        resultElement.textContent =
        "Check each appliance: enter a name, positive running watts, optional positive starting watts, a whole-number quantity, and usage between 0 and 24 hours per day.";
        return;
    }
    let result;
    try {
        result = SolarSizingEngine.calculate(
            appliances,
            {
                location,
                backupHours,
                panelWatts,
                batteryUnitKwh
            }
        );
    } catch (error) {
        resultElement.textContent =
            error.message || "Please check the appliance inputs.";
        return;
    }

    resultElement.innerHTML = `

        <section class="calculator-results">

            <h2>Estimated Solar System</h2>
            ${appliances.some(appliance => appliance.startingWatts === null) ? '<p class="calculator-warning"><strong>Surge verification needed:</strong> Running watts are only a provisional estimate for appliances with unknown starting watts. Confirm actual motor and compressor starting requirements, then check the inverter manufacturer’s surge rating and supported surge duration before installation.</p>' : '<p class="calculator-warning"><strong>Verify inverter surge compatibility:</strong> Check entered starting-watt values against appliance specifications and confirm that the selected inverter supports the required surge power for the necessary duration before installation.</p>'}

            <p>
                <strong>Location:</strong>
                ${result.location}
            </p>

            <p>
                <strong>Estimated daily consumption:</strong>
                ${result.dailyEnergyKwh} kWh/day
            </p>

            <p>
                <strong>Design demand (includes 15% growth allowance):</strong>
                 ${result.designDailyEnergyKwh} kWh/day
            </p>

            <p>
                <strong>Recommended solar PV:</strong>
                ${result.requiredPvKw} kWp
            </p>

            <p>
                <strong>Solar panels:</strong>
                ${result.panelCount} &times; ${result.panelWatts} W
                (${result.actualPvKw} kWp)
            </p>

            <p>
                <strong>Estimated required continuous inverter capacity:</strong>
                ${result.requiredInverterKw} kW
            </p>

            <p>
                <strong>Estimated starting load:</strong>
                ${result.startingLoadKw} kW
            </p>

            <p>
                <strong>Estimated design starting load (includes 15% allowance):</strong>
                ${result.designStartingLoadKw} kW
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
                <strong>Selected battery configuration:</strong>
                ${result.batteryCount} &times; ${result.batteryUnitKwh} kWh
            </p>

            <p>
                <strong>Estimated 48 V battery current:</strong>
                ${result.batteryCurrentA} A
            </p>

            <hr>
<aside class="calculator-quote-prompt" style="border:1px solid #d5e4d8;border-radius:10px;padding:18px;margin:18px 0;">
    <h3>Let's Turn Your Estimate Into a Solar Plan</h3>
    <p>Your estimate is a starting point. Our engineering review helps confirm suitable panel capacity, inverter sizing, battery backup and equipment compatibility for your needs.</p>
    <p>Before installation, we will review the system requirements and prepare a quotation based on confirmed specifications. A site assessment may be needed.</p>
    <p><strong>Ready to take the next step?</strong> Send your requirements to Brian Solar &amp; Electrical and let us help you plan with confidence.</p>
    <p><a class="nav-cta" href="https://wa.me/254796433537?text=Hello%20Brian%20Solar%20%26%20Electrical%2C%20I%20used%20your%20solar%20calculator%20and%20would%20like%20an%20engineer-reviewed%20quotation.%20Please%20review%20my%20requirements%20and%20advise%20on%20the%20next%20steps.">Request Your Engineer-Reviewed Quotation</a></p>
    <p><small>Calculator results are preliminary estimates, not a final quotation or approved system design. Final specifications and pricing are subject to engineering review and, where necessary, site assessment.</small></p>
</aside>

        </section>
    `;
}


function estimateBatteryChargingTime() {
    const resultElement = document.getElementById("battery-charge-result");

    try {
        const inputIds = [
            "charge-battery-kwh",
            "charge-start-soc",
            "charge-target-soc",
            "charge-panel-count",
            "charge-panel-watts",
            "charge-efficiency"
        ];
        const rawValues = inputIds.map(id =>
            document.getElementById(id).value.trim()
        );
        if (rawValues.some(value => value === "")) {
            throw new Error("Please complete all battery charging inputs.");
        }

        const result = SolarSizingEngine.estimateBatteryChargingTime({
            batteryCapacityKwh: Number(rawValues[0]),
            startingSocPercent: Number(rawValues[1]),
            targetSocPercent: Number(rawValues[2]),
            panelCount: Number(rawValues[3]),
            panelWatts: Number(rawValues[4]),
            efficiency: Number(rawValues[5]) / 100
        });

        const totalMinutes = result.estimatedMinutes;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        resultElement.innerHTML = `
            <section class="calculator-results">
                <h3>Estimated Battery Charging Time</h3>
                <p><strong>Estimated time:</strong> ${hours} h ${minutes} min</p>
                <p><strong>Energy to replenish:</strong> ${result.energyNeededKwh.toFixed(2)} kWh</p>
                <p><strong>Solar array:</strong> ${result.arrayPowerKw.toFixed(3)} kWp</p>
                <p><strong>Assumed effective output:</strong> ${result.effectivePowerKw.toFixed(3)} kW</p>
                <p>This is an equivalent full-output estimate, not a guaranteed elapsed charging time. Actual charging depends on sunlight, temperature, battery charge limits, controller compatibility and loads operating during charging.</p>
            </section>`;
    } catch (error) {
        resultElement.textContent = error.message || "Please check the charging inputs.";
    }
}
document.addEventListener("DOMContentLoaded", () => {

    addApplianceRow("tv", 1, 4);
    addApplianceRow("fridge", 1, 8);
    addApplianceRow("lights", 6, 6);
    addApplianceRow("wifi", 1, 24);

});
