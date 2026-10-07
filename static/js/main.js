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

    /*
     * Reserve a browser window while still inside the user's
     * submit action. This reduces the chance that the browser
     * blocks WhatsApp as a popup after the network request.
     */
    let whatsappWindow = null;

    try {
      whatsappWindow = window.open("about:blank", "_blank");

      if (whatsappWindow) {
        whatsappWindow.document.title = "Opening WhatsApp...";
      }
    } catch (error) {
      console.warn("Could not reserve WhatsApp window.", error);
    }

    submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "Processing Request...";

    setMessage(
      "Processing your quotation request...",
      "success"
    );

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

      /*
       * Send the reserved window to WhatsApp after the lead
       * request has been submitted.
       */
      if (whatsappWindow && !whatsappWindow.closed) {
        whatsappWindow.location.href = whatsappURL;
      } else {
        /*
         * Popup was blocked or the reserved window was closed.
         * Fall back to opening WhatsApp normally.
         */
        const fallbackWindow = window.open(whatsappURL, "_blank");

        if (!fallbackWindow) {
          setMessage(
            "Your request was processed, but WhatsApp was blocked by your browser. Please allow pop-ups and try again.",
            "warning"
          );
        }
      }

      if (
        response.ok &&
        result &&
        result.success
      ) {
        setMessage(
          "Request recorded successfully. WhatsApp is ready — please press Send.",
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

      /*
       * Even if Google Apps Script fails, do not lose the
       * customer's WhatsApp path.
       */
      if (whatsappWindow && !whatsappWindow.closed) {
        whatsappWindow.location.href = whatsappURL;

        setMessage(
          "WhatsApp is ready. Please press Send. The online lead record could not be confirmed.",
          "warning"
        );
      } else {
        const fallbackWindow = window.open(whatsappURL, "_blank");

        if (fallbackWindow) {
          setMessage(
            "WhatsApp is ready. Please press Send. The online lead record could not be confirmed.",
            "warning"
          );
        } else {
          setMessage(
            "The request could not be completed because WhatsApp was blocked by your browser. Please allow pop-ups and try again.",
            "error"
          );
        }
      }
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

  const revealItems = document.querySelectorAll(
    ".work-process-card, .why-choose-card"
  );

  if (revealItems.length) {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
    } else {
      const observer = new IntersectionObserver(
        (entries, revealObserver) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }

            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          });
        },
        {
          threshold: 0.15,
          rootMargin: "0px 0px -40px 0px"
        }
      );

      revealItems.forEach((item) => observer.observe(item));
    }
  }
})();
