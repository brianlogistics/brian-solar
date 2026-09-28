(() => {
  "use strict";

  const form = document.getElementById("solarForm");
  const submitButton = document.getElementById("submitButton");
  const msg = document.getElementById("msg");

  if (!form || !submitButton || !msg) {
    return;
  }

  const GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbyOpBLFEfPQzDuLUgNpot8LOU9fy27hGEDJTkuR5QrbNFvZLuoqmLN6NOHiSVeJxBvh/exec";

  const WHATSAPP_NUMBER = "254796433537";
  const WEBSITE_URL = "https://www.briansolar.co.ke/";

  let submitting = false;

  function setMessage(message, type) {
    msg.textContent = message;
    msg.className = "form-message";

    if (type) {
      msg.classList.add(type);
    }
  }

  function normalisePhone(phone) {
    let value = phone.replace(/[^\d+]/g, "").trim();

    if (value.startsWith("07")) {
      value = "254" + value.substring(1);
    }

    if (value.startsWith("01")) {
      value = "254" + value.substring(1);
    }

    if (value.startsWith("+254")) {
      value = value.substring(1);
    }

    return value;
  }

  function isValidKenyanPhone(phone) {
    return /^254(7|1)\d{8}$/.test(phone);
  }

  function generateLeadId() {
    const now = new Date();

    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      "-" +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    const random = Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase();

    return "BS-" + timestamp + "-" + random;
  }

  function buildWhatsAppMessage(data) {
    return `NEW WEBSITE LEAD

Lead ID: ${data.leadId}

Name: ${data.name}

Phone: ${data.phone}

Location: ${data.location}

Service: ${data.service}

Budget: ${data.budget}

Project Details:
${data.notes}

Source: Website
${WEBSITE_URL}`;
  }

  function buildWhatsAppURL(message) {
    return (
      "https://wa.me/" +
      WHATSAPP_NUMBER +
      "?text=" +
      encodeURIComponent(message)
    );
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const name = document.getElementById("name").value.trim();
    const rawPhone = document.getElementById("phone").value.trim();
    const location = document.getElementById("location").value.trim();
    const service = document.getElementById("service").value;
    const budget = document.getElementById("budget").value;
    const notes = document.getElementById("notes").value.trim();
    const website = document.getElementById("website").value.trim();

    if (website !== "") {
      setMessage("Submission rejected.", "error");
      return;
    }

    if (!name) {
      setMessage("Please enter your full name.", "error");
      return;
    }

    if (!rawPhone) {
      setMessage("Please enter your phone number.", "error");
      return;
    }

    const phone = normalisePhone(rawPhone);

    if (!isValidKenyanPhone(phone)) {
      setMessage(
        "Please enter a valid Kenyan phone number, for example 0796 433 537.",
        "error"
      );
      return;
    }

    if (!location) {
      setMessage("Please enter your location.", "error");
      return;
    }

    if (!service) {
      setMessage("Please select the service you need.", "error");
      return;
    }

    if (!budget) {
      setMessage("Please select your budget range.", "error");
      return;
    }

    if (!notes) {
      setMessage("Please describe your project requirements.", "error");
      return;
    }

    if (typeof grecaptcha === "undefined") {
      setMessage(
        "Security verification could not load. Please refresh the page.",
        "error"
      );
      return;
    }

    const captchaToken = grecaptcha.getResponse();

    if (!captchaToken) {
      setMessage(
        "Please complete the reCAPTCHA verification.",
        "error"
      );
      return;
    }

    const leadData = {
      leadId: generateLeadId(),
      name: name,
      phone: rawPhone,
      normalisedPhone: phone,
      location: location,
      service: service,
      budget: budget,
      notes: notes,
      website: website,
      recaptchaToken: captchaToken,
      source: "website",
      page: window.location.pathname,
      pageUrl: window.location.href,
      referrer: document.referrer || "",
      userAgent: navigator.userAgent,
      submittedAt: new Date().toISOString()
    };

    const whatsappMessage = buildWhatsAppMessage(leadData);
    const whatsappURL = buildWhatsAppURL(whatsappMessage);

    const whatsappWindow = window.open(
      whatsappURL,
      "_blank",
      "noopener,noreferrer"
    );

    submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "Processing Request...";

    if (!whatsappWindow) {
      setMessage(
        "Your quotation request is ready. Please use the WhatsApp button to send the message.",
        "warning"
      );
    } else {
      setMessage(
        "WhatsApp has been prepared. Please press Send in WhatsApp.",
        "success"
      );
    }

    try {
      const response = await fetch(
        GOOGLE_SCRIPT_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(leadData)
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch (error) {
        console.warn(
          "Google Apps Script did not return JSON.",
          error
        );
      }

      if (
        response.ok &&
        result &&
        result.success
      ) {
        setMessage(
          "Request recorded successfully. Please press Send in WhatsApp to contact us.",
          "success"
        );

        form.reset();

        if (typeof grecaptcha !== "undefined") {
          grecaptcha.reset();
        }
      } else {
        setMessage(
          "WhatsApp is ready. Your quotation request could not be confirmed in our records.",
          "warning"
        );
      }
    } catch (error) {
      console.error("Lead submission failed:", error);

      setMessage(
        "WhatsApp is ready. Please press Send in WhatsApp. We could not confirm the online lead record.",
        "warning"
      );
    } finally {
      submitting = false;
      submitButton.disabled = false;
      submitButton.textContent = "Get Free Quotation";
    }
  });
})();

/* MOBILE NAVIGATION */

(() => {
  "use strict";

  const navToggle = document.querySelector(".nav-toggle");
  const mainNavigation = document.getElementById("main-navigation");

  if (!navToggle || !mainNavigation) {
    return;
  }

  navToggle.addEventListener("click", () => {
    const isOpen = mainNavigation.classList.toggle("is-open");

    navToggle.setAttribute(
      "aria-expanded",
      isOpen ? "true" : "false"
    );

    navToggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation" : "Open navigation"
    );
  });

  mainNavigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNavigation.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open navigation");
    });
  });
})();
