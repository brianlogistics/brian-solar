let applianceRowCount = 0;

function escapeCalculatorHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function addApplianceRow() {
    const list = document.getElementById("appliance-list");
    const row = document.createElement("div");
    row.className = "calculator-appliance-row";
    row.dataset.rowId = applianceRowCount++;
    row.innerHTML = `
        <label>Appliance name
            <input class="appliance-name" type="text" maxlength="100"
                placeholder="e.g. Refrigerator" required>
        </label>
        <label>Running watts (W)
            <input class="appliance-watts" type="number" min="0.1"
                step="any" placeholder="e.g. 180" required>
        </label>
        <label>Starting watts (W, optional)
            <input class="appliance-starting-watts" type="number" min="0.1"
                step="any" placeholder="If known">
        </label>
        <label>Quantity
            <input class="appliance-quantity" type="number" min="1"
                step="1" value="1" required>
        </label>
        <label>Hours used per day
            <input class="appliance-hours" type="number" min="0"
                max="24" step="any" placeholder="0-24" required>
        </label>
        <button type="button" class="remove-appliance">Remove</button>
    `;
    row.querySelector(".remove-appliance").addEventListener("click", () => row.remove());
    list.appendChild(row);
}

function collectAppliances() {
    const rows = [...document.querySelectorAll(".calculator-appliance-row")];
    return rows.map((row, index) => {
        const name = row.querySelector(".appliance-name").value.trim();
        const wattsText = row.querySelector(".appliance-watts").value.trim();
        const startingText = row.querySelector(".appliance-starting-watts").value.trim();
        const quantityText = row.querySelector(".appliance-quantity").value.trim();
        const hoursText = row.querySelector(".appliance-hours").value.trim();

        if (!name || !wattsText || !quantityText || !hoursText) {
            throw new Error(`Appliance row ${index + 1}: complete the name, running watts, quantity and daily hours.`);
        }

        const watts = Number(wattsText);
        const startingWatts = startingText === "" ? null : Number(startingText);
        const quantity = Number(quantityText);
        const hours = Number(hoursText);

        if (!Number.isFinite(watts) || watts <= 0) {
            throw new Error(`Appliance row ${index + 1}: running watts must be greater than zero.`);
        }
        if (startingWatts !== null &&
            (!Number.isFinite(startingWatts) || startingWatts <= 0)) {
            throw new Error(`Appliance row ${index + 1}: starting watts must be positive or left blank.`);
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new Error(`Appliance row ${index + 1}: quantity must be a whole number greater than zero.`);
        }
        if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
            throw new Error(`Appliance row ${index + 1}: daily usage must be between 0 and 24 hours.`);
        }

        return { name, watts, startingWatts, quantity, hours };
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

    let appliances;
    const resultElement = document.getElementById("calculator-result");
    if (!Number.isFinite(backupHours) || backupHours < 0 ||
        !Number.isFinite(panelWatts) || panelWatts <= 0) {
        resultElement.textContent = "Please enter valid backup hours and a positive solar panel wattage.";
        return;
    }

    try {
        appliances = collectAppliances();
    } catch (error) {
        resultElement.textContent = error.message || "Please check the appliance inputs.";
        return;
    }

    if (!appliances.length) {
        resultElement.textContent = "Please add at least one appliance.";
        return;
    }

    let result;
    try {
        result = SolarSizingEngine.calculate(
            appliances,
            {
                location,
                backupHours,
                panelWatts
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

            <p>
                <strong>Location:</strong>
                ${result.location}
            </p>

            <p>
                <strong>Total daily consumption:</strong>
                ${Math.round(result.dailyEnergyKwh * 1000).toLocaleString()} Wh/day
                (${result.dailyEnergyKwh} kWh/day)
            </p>

            <p>
                <strong>Design demand with growth allowance:</strong>
                ${Math.round(result.designDailyEnergyKwh * 1000).toLocaleString()} Wh/day
                (${result.designDailyEnergyKwh} kWh/day)
            </p>

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
            ${appliances.some(appliance => appliance.startingWatts === null) ? '<p class="calculator-warning"><strong>Surge verification needed:</strong> Running watts are only a provisional estimate for appliances with unknown starting watts. Confirm actual motor and compressor starting requirements, then check the inverter manufacturer’s surge rating and supported surge duration before installation.</p>' : '<p class="calculator-warning"><strong>Verify inverter surge compatibility:</strong> Check entered starting-watt values against appliance specifications and confirm that the selected inverter supports the required surge power for the necessary duration before installation.</p>'}

            <p>
                <strong>Recommended solar PV:</strong>
                ${result.requiredPvKw} kWp
            </p>

            <p>
                <strong>Solar panels:</strong>
                ${result.panelCount} x ${result.panelWatts} W
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
                <strong>Example battery configuration:</strong>
                ${result.batteryCount} x ${result.batteryUnitKwh} kWh
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
document.addEventListener("DOMContentLoaded", () => addApplianceRow());
