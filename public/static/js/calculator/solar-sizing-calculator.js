// Brian Solar & Electrical - Solar Sizing Calculator

function calculateSolarSystem() {

    const appliancePower = Number(document.getElementById("daily-load").value);
    const sunlightHours = Number(document.getElementById("sun-hours").value);
    const batteryDays = Number(document.getElementById("backup-days").value);

    if (!appliancePower || !sunlightHours || !batteryDays) {
        document.getElementById("calculator-result").innerHTML =
            "Please enter all values.";
        return;
    }

    // Solar panel sizing (Watts)
    const solarSize = Math.ceil(
        appliancePower / sunlightHours * 1.3
    );

    // Battery sizing (Wh)
    const batterySize = Math.ceil(
        appliancePower * batteryDays * 1.5
    );

    // Convert to kWh
    const batteryKwh = (batterySize / 1000).toFixed(1);

    document.getElementById("calculator-result").innerHTML =
        `
        <h3>Estimated System Size</h3>
        <p><strong>Solar Panels:</strong> ${solarSize} Watts</p>
        <p><strong>Battery Capacity:</strong> ${batteryKwh} kWh</p>
        <p>Contact Brian Solar & Electrical for a professional site assessment and quotation.</p>
        `;
}