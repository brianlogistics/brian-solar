let applianceRowCount = 0;

function escapeCalculatorHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

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
        <label class="calculator-backup-option">
            <input class="appliance-backup-enabled" type="checkbox"
                onchange="this.closest('.calculator-appliance-row').querySelector('.appliance-backup-hours').disabled = !this.checked">
            Include in backup
        </label>
        <label>Backup hours
            <input class="appliance-backup-hours" type="number" min="0.5" max="24" step="0.5" value="8" disabled>
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
            hours: hoursInput === "" ? NaN : Number(hoursInput),
            backupEnabled: row.querySelector(".appliance-backup-enabled").checked,
            backupHours: Number(row.querySelector(".appliance-backup-hours").value)
        };
    });
}
function toggleCustomSunHours() {
    const locationSelect = document.getElementById("solar-location");
    const container = document.getElementById("custom-sun-hours-container");
    const input = document.getElementById("custom-sun-hours");

    if (!locationSelect || !container || !input) return;

    const isCustom = locationSelect.value === "custom";
    container.hidden = !isCustom;
    input.required = isCustom;
}
function calculateSolarSystem() {

    const location =
        document.getElementById("solar-location").value;

    const customSunHoursInput = document.getElementById("custom-sun-hours");
    const sunHours = location === "custom"
        ? Number(customSunHoursInput.value)
        : undefined;

    if (location === "custom" &&
        (!Number.isFinite(sunHours) || sunHours < 0.5 || sunHours > 12)) {
        document.getElementById("calculator-result").textContent =
            "Enter a valid custom Peak Sun Hours value between 0.5 and 12.";
        return;
    }

    const backupHours =
        Number(
            document.getElementById("backup-hours").value
        );

    const panelWatts =
        Number(
            document.getElementById("panel-watts").value
        );



    const resultElement =
        document.getElementById("calculator-result");

    if (!resultElement) return;

    const batterySelect = document.getElementById("battery-unit-kwh");
    const customBatteryInput = document.getElementById("custom-battery-unit-kwh");
    const batteryVoltageSelect = document.getElementById("battery-voltage");
    if (!batterySelect || !customBatteryInput || !batteryVoltageSelect) {
        resultElement.textContent = "The battery selection controls could not be found. Please reload the calculator.";
        return;
    }

    const batteryUnitKwh = batterySelect.value === "custom"
        ? Number(customBatteryInput.value)
        : Number(batterySelect.value);

    const appliances =
        collectAppliances();
    const batteryVoltage = Number(batteryVoltageSelect.value);

    if (![12, 24, 48].includes(batteryVoltage)) {
        resultElement.textContent = "Please select 12 V, 24 V or 48 V for the battery-current estimate.";
        return;
    }

    if (!Number.isFinite(backupHours) || backupHours < 0 || backupHours > 24 ||
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

    const invalidApplianceIndex = appliances.findIndex(appliance =>
        typeof appliance.name !== "string" ||
        appliance.name.trim() === "" ||
        !Number.isFinite(appliance.watts) ||
        appliance.watts <= 0 ||
        (appliance.startingWatts !== null &&
            (!Number.isFinite(appliance.startingWatts) || appliance.startingWatts <= 0)) ||
        !Number.isFinite(appliance.quantity) ||
        !Number.isInteger(appliance.quantity) ||
        appliance.quantity <= 0 ||
        !Number.isFinite(appliance.hours) ||
        appliance.hours < 0 ||
        appliance.hours > 24
    );

    if (invalidApplianceIndex !== -1) {
        resultElement.textContent =
            `Appliance row ${invalidApplianceIndex + 1}: check the name, positive running watts, optional positive starting watts, whole-number quantity, and daily usage between 0 and 24 hours.`;
        return;
    }
    const invalidBackupIndex = appliances.findIndex(appliance =>
        appliance.backupEnabled &&
        (
            !Number.isFinite(appliance.backupHours) ||
            appliance.backupHours < 0.5 ||
            appliance.backupHours > backupHours
        )
    );

    if (invalidBackupIndex !== -1) {
        resultElement.textContent =
            `Appliance row ${invalidBackupIndex + 1}: backup hours must be at least 0.5 and must not exceed the overall backup duration selected above.`;
        return;
    }

    let result;
    try {
        result = SolarSizingEngine.calculate(
            appliances,
            {
                location: location === "custom" ? "Custom location" : location,
                sunHours,
                backupHours,
                panelWatts,
                batteryUnitKwh,
                batteryVoltage,
            }
        );
    } catch (error) {
        resultElement.textContent =
            error.message || "Please check the appliance inputs.";
        return;
    }

    const batteryRecommendation = result.requiredBatteryKwh > 0
        ? SolarSizingEngine.recommendBatteryOptions(result.requiredBatteryKwh)
        : null;

    const applianceMessage = appliances.map((appliance, index) =>
        `${index + 1}. ${appliance.name}: ${appliance.watts} W running, ` +
        `starting watts: ${appliance.startingWatts === null ? "not supplied" : appliance.startingWatts + " W"}, ` +
        `quantity: ${appliance.quantity}, usage: ${appliance.hours} hours/day, ` +
        `backup: ${appliance.backupEnabled ? appliance.backupHours + " hours" : "not selected"}`
    ).join("\n");

    const supplierBatteryMessage = batteryRecommendation && batteryRecommendation.best
        ? `${batteryRecommendation.best.quantity} x ${batteryRecommendation.best.capacityKwh} kWh (${batteryRecommendation.best.totalCapacityKwh} kWh nominal)`
        : "No suitable supplier battery option currently identified";

    const projectLocationMessage = location === "custom"
        ? "Custom location - customer to provide actual town, county and site area"
        : result.location;

    const calculatorWhatsAppMessage = [
        "SOLAR CALCULATOR - QUOTATION REQUEST",
        "",
        "Hello Brian Solar & Electrical. I have completed the solar calculator and request a technical review and official quotation.",
        "",
        "PROJECT LOCATION: " + projectLocationMessage,
        "PEAK SUN HOURS: " + result.sunHours + " hours/day",
        "",
        "APPLIANCES AND USAGE:",
        applianceMessage,
        "",
        "CALCULATOR ESTIMATES:",
        "Daily energy: " + result.dailyEnergyKwh + " kWh/day",
        "Design daily energy: " + result.designDailyEnergyKwh + " kWh/day",
        "Required solar PV: " + result.requiredPvKw + " kWp",
        "Panel estimate: " + result.panelCount + " x " + result.panelWatts + " W",
        "Estimated inverter capacity: " + result.requiredInverterKw + " kW",
        "Estimated starting load: " + result.startingLoadKw + " kW",
        "Design starting load: " + result.designStartingLoadKw + " kW",
        "Backup requirement: " + result.backupHours + " hours",
        "Estimated required battery capacity: " + result.requiredBatteryKwh + " kWh",
        "Selected calculator battery configuration: " + result.batteryCount + " x " + result.batteryUnitKwh + " kWh",
        "Estimated supplier battery recommendation: " + supplierBatteryMessage,
        "Assumed battery-bank voltage: " + result.batteryVoltage + " V",
        "",
        "Please review the calculations, appliance starting requirements, inverter surge capability, battery configuration and equipment compatibility.",
        "",
        "ITEMISED QUOTATION REQUEST:",
        "Please provide quantities, specifications, brands/models and unit prices for panels, inverter, batteries, mounting structures, protection equipment, cables, accessories, installation, labour, commissioning, transport and any applicable assessment costs.",
        "",
        "INCLUSIONS AND EXCLUSIONS:",
        "Please clearly state everything included and excluded. Identify additional costs, where applicable, for civil works, trenching, extra cable runs, distribution-board modifications, earthing, lightning protection, transport, site assessment, permits and other site-specific work. Price additional work separately.",
        "",
        "Please also state warranties, delivery arrangements, payment terms, assumptions and any proposed equipment substitutions. I need an itemised quotation so I can compare systems on the same basis.",
        "",
        "IMPORTANT: These calculator results are preliminary estimates only. They are not a verified quotation, confirmed equipment selection or approved system design. Final sizing, specifications, compatibility, supplier stock, installation scope and prices must be reviewed and confirmed by Brian Solar & Electrical before an official quotation is issued.",
        "",
        "My name: [Please add]",
        "My project town/county and site area: [Please add if not already stated]"
    ].join("\n");

    const calculatorWhatsAppUrl =
        "https://wa.me/254796433537?text=" +
        encodeURIComponent(calculatorWhatsAppMessage);

    resultElement.innerHTML = `

        <section class="calculator-results">

            <h2>Estimated Solar System</h2>
            <p><strong>Solar resource used:</strong> ${result.sunHours} peak sun hours/day (${location === "custom" ? "customer-supplied estimate" : "location preset"})</p>
            <h3>Daily Energy by Appliance</h3>
            <div class="calculator-energy-table">
                <table>
                    <thead><tr><th>Appliance</th><th>Rated watts</th><th>Qty</th><th>Hours/day</th><th>Wh/day</th><th>kWh/day</th></tr></thead>
                    <tbody>
                        ${appliances.map(appliance => {
                            const wh = appliance.watts * appliance.quantity * appliance.hours;
                            return `<tr>
                                <td>${escapeCalculatorHtml(appliance.name)}</td>
                                <td>${appliance.watts}</td>
                                <td>${appliance.quantity}</td>
                                <td>${appliance.hours}</td>
                                <td>${Math.round(wh).toLocaleString()}</td>
                                <td>${(wh / 1000).toFixed(3)}</td>
                            </tr>`;
                        }).join("")}
                    </tbody>
                </table>
            </div>

            ${appliances.some(appliance => appliance.startingWatts === null) ? '<p class="calculator-warning"><strong>Surge verification needed:</strong> Running watts are only a provisional estimate for appliances with unknown starting watts. Confirm actual motor and compressor starting requirements, then check the inverter manufacturer&#39;s published surge rating and supported surge duration before installation.</p>' : '<p class="calculator-warning"><strong>Verify inverter surge compatibility:</strong> Check entered starting-watt values against appliance specifications and confirm that the selected inverter supports the required surge power for the necessary duration before installation.</p>'}

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
                <strong>Required continuous inverter capacity (includes 15% growth allowance and 25% inverter design margin):</strong>
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

            ${batteryRecommendation
                ? batteryRecommendation.best
                    ? `<aside class="calculator-battery-recommendation">
                        <h3>Recommended Supplier Battery Configuration</h3>
                        <p><strong>Best fit:</strong>
                        ${batteryRecommendation.best.quantity} &times;
                        ${batteryRecommendation.best.capacityKwh} kWh
                        (${batteryRecommendation.best.totalCapacityKwh} kWh nominal capacity)</p>
                        ${batteryRecommendation.alternatives.length
                            ? `<p><strong>Other suitable options:</strong>
                                ${batteryRecommendation.alternatives.map(option =>
                                    `${option.quantity} &times; ${option.capacityKwh} kWh (${option.totalCapacityKwh} kWh total)`
                                ).join("; ")}
                            </p>`
                            : ""}
                        <p><small>Recommendations use supplier-supported battery sizes currently marked as available. Final availability, compatibility and pricing must be confirmed before quotation.</small></p>
                    </aside>`
                    : `<p class="calculator-warning">No supplier battery option is currently marked as available for this estimated capacity. Please contact Brian Solar &amp; Electrical for assistance.</p>`
                : ""}
            <p>
                <strong>Selected battery configuration:</strong>
                ${result.batteryCount} &times; ${result.batteryUnitKwh} kWh
            </p>

            <p>
                <strong>Estimated DC battery current at ${result.batteryVoltage} V:</strong>
                ${result.batteryCurrentA} A
            </p>

            <hr>
<aside class="calculator-quote-prompt" style="border:1px solid #d5e4d8;border-radius:10px;padding:18px;margin:18px 0;">
    <h3>Let's Turn Your Estimate Into a Solar Plan</h3>
    <p>Your estimate is a starting point. Our engineering review helps confirm suitable panel capacity, inverter sizing, battery backup and equipment compatibility for your needs.</p>
    <p>Before installation, we will review the system requirements and prepare a quotation based on confirmed specifications. A site assessment may be needed.</p>
    <p><strong>Ready to take the next step?</strong> Send your requirements to Brian Solar &amp; Electrical and let us help you plan with confidence.</p>
    <p><a class="nav-cta" href="${calculatorWhatsAppUrl}" target="_blank" rel="noopener noreferrer">Request Your Engineer-Reviewed Quotation</a></p>
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
        const rawValues = inputIds.map(id => {
            const input = document.getElementById(id);
            if (!input) {
                throw new Error("Required charging input is missing: " + id + ".");
            }
            return input.value.trim();
        });
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
    toggleCustomSunHours();

    addApplianceRow("tv", 1, 4);
    addApplianceRow("fridge", 1, 8);
    addApplianceRow("lights", 6, 6);
    addApplianceRow("wifi", 1, 24);

});
