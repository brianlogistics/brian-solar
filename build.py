from pathlib import Path
import json
import re
import shutil
from html import escape, unescape

ROOT = Path(__file__).parent
PUBLIC = ROOT / "public"
DATA = json.loads(
    (ROOT / "data" / "business.json").read_text(
        encoding="utf-8-sig"
    )
)
TEMPLATES = ROOT / "templates"
STATIC = ROOT / "static"
CONTENT = ROOT / "content"
LEGACY = ROOT / "legacy"

OFFICIAL_TAGLINE = "Powering Your Future. Protecting What Matters."


def render(template, **ctx):
    path = TEMPLATES / template
    text = path.read_text(encoding="utf-8-sig")

    include_pattern = re.compile(
        r'{%\s*include\s+"([^"]+)"\s*%}'
    )

    while True:
        match = include_pattern.search(text)

        if not match:
            break

        include_name = match.group(1)
        include_path = TEMPLATES / include_name

        include_text = include_path.read_text(
            encoding="utf-8-sig"
        )

        text = (
            text[:match.start()]
            + include_text
            + text[match.end():]
        )

    loop_pattern = re.compile(
        r'{%\s*for\s+service\s+in\s+services\s*%}'
        r'(.*?)'
        r'{%\s*endfor\s*%}',
        re.DOTALL
    )

    def render_services(match):
        block = match.group(1)
        output = []

        for service in DATA["services"]:
            item = block

            for key, value in service.items():
                pattern = re.compile(
                    r'{{\s*service\.'
                    + re.escape(key)
                    + r'\s*}}'
                )

                item = pattern.sub(
                    escape(str(value)),
                    item
                )

            output.append(item)

        return "".join(output)

    text = loop_pattern.sub(
        render_services,
        text
    )

    service = ctx.get("service")

    if service:
        for key, value in service.items():
            pattern = re.compile(
                r'{{\s*service\.'
                + re.escape(key)
                + r'\s*}}'
            )

            text = pattern.sub(
                escape(str(value)),
                text
            )

    replacements = {
        "business_name": DATA["name"],
        "registered_name": DATA["registered_name"],
        "email": DATA["email"],
        "phone": DATA["phone"],
        "phone_display": DATA["phone_display"],
        "whatsapp_url": DATA["whatsapp_url"],
        "domain": DATA["domain"],
        "official_tagline": OFFICIAL_TAGLINE,
    }

    for key, value in ctx.items():
        if isinstance(value, str):
            replacements[key] = value

    for key, value in replacements.items():
        pattern = re.compile(
            r'{{\s*'
            + re.escape(key)
            + r'\s*}}'
        )

        text = pattern.sub(
            lambda m, v=str(value): v,
            text
        )

    return text


def add_business_schema(html, canonical):
    """
    Add the permanent Organization identity for this service-area business.
    No unverified physical address is published.
    """

    organization_id = DATA["domain"].rstrip("/") + "/#organization"

    # Keep configured service areas as text; do not assume every area is a city.
    area_served = DATA.get("primary_service_areas", [])

    schema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": organization_id,
        "name": DATA["name"],
        "legalName": DATA["registered_name"],
        "url": DATA["domain"].rstrip("/") + "/",
        "logo": DATA["domain"].rstrip("/") + "/static/images/logo-164.webp",
        "telephone": DATA["phone"],
        "email": DATA["email"],
        "description": (
            "Solar, electrical, CCTV and electric fence installation, "
            "maintenance and repair services for homes, businesses, "
            "farms and institutions across Kenya."
        ),
        "areaServed": area_served,
        "knowsAbout": [
            service["name"] for service in DATA.get("services", [])
        ],
        "contactPoint": {
            "@type": "ContactPoint",
            "telephone": DATA["phone"],
            "email": DATA["email"],
            "contactType": "customer service",
            "url": DATA["whatsapp_url"]
        },
        "sameAs": [
            "https://www.facebook.com/briansolarelectrical"
        ]
    }

    json_ld = json.dumps(
        schema,
        ensure_ascii=False,
        separators=(",", ":")
    ).replace("<", "\\u003c")

    block = (
        '\n<script type="application/ld+json">'
        + json_ld
        + '</script>\n'
    )

    if "</head>" in html:
        return html.replace("</head>", block + "</head>", 1)

    return html + block

def page(
    path,
    template,
    title,
    description,
    canonical=None,
    article_schema=False,
    **ctx
):
    out = PUBLIC / path
    out.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    if canonical is None:
        if path == Path("index.html"):
            canonical = DATA["domain"].rstrip("/") + "/"
        else:
            clean = str(path).replace("\\", "/")

            if clean.endswith("/index.html"):
                clean = clean[:-len("/index.html")]

            canonical = (
                DATA["domain"].rstrip("/")
                + "/"
                + clean.strip("/")
                + "/"
            )

    content = render(
        template,
        services=DATA["services"],
        **ctx
    )

    # Google reCAPTCHA is loaded on demand by main.js when the
    # homepage quotation form approaches the viewport or is used.
    recaptcha_script = ""

    html = render(
        "base.html",
        content=content,
        title=title,
        description=description,
        canonical=canonical,
        recaptcha_script=recaptcha_script
    )

    html = add_business_schema(html, canonical)

    if article_schema:
        article_json_ld = json.dumps(
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": title,
                "description": description,
                "author": {"@id": DATA["domain"].rstrip("/") + "/#organization"},
                "publisher": {"@id": DATA["domain"].rstrip("/") + "/#organization"},
                "mainEntityOfPage": {
                    "@type": "WebPage",
                    "@id": canonical
                }
            },
            ensure_ascii=False,
            separators=(",", ":")
        ).replace("<", "\\u003c")

        article_block = (
            '\n<script type="application/ld+json">'
            + article_json_ld
            + '</script>\n'
        )

        if "</head>" in html:
            html = html.replace(
                "</head>",
                article_block + "</head>",
                1
            )

    out.write_text(
        html,
        encoding="utf-8",
        newline="\n"
    )


def copy_static():
    if not STATIC.exists():
        return

    destination_root = PUBLIC / "static"

    for source in STATIC.rglob("*"):
        if source.is_file():
            name_lower = source.name.lower()
            if ".backup" in name_lower or "candidate" in name_lower or "preview" in name_lower or "comparison-preview" in name_lower or "original-archive-" in name_lower:
                continue
            relative = source.relative_to(STATIC)
            destination = destination_root / relative

            destination.parent.mkdir(
                parents=True,
                exist_ok=True
            )

            shutil.copy2(
                source,
                destination
            )


    # Copy the favicon to the website root.
    favicon_source = STATIC / "favicon.ico"
    if favicon_source.is_file():
        shutil.copy2(favicon_source, PUBLIC / "favicon.ico")

def clean_public():
    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)

    PUBLIC.mkdir(parents=True)


def clean_source_html(html):
    """
    Extract useful content from legacy HTML.

    Some migrated source files contain escaped HTML such as
    Some migrated source files contain escaped HTML such as <h1> and </h1>.
    headings inside legacy headers are not accidentally removed.
    """

    # Normalize escaped HTML markup before extraction.
    html = html.replace("\\<", "<")
    html = html.replace("\\>", ">")

    # Source files are already UTF-8.
    # Do not perform a blanket Latin-1/UTF-8 conversion here because
    # valid Unicode characters such as Ã¢â‚¬Â¢, Ã¢â€ â€™, Ã¢â‚¬â€ and Ã¢â‚¬â€œ would be corrupted.

    # Normalize a few obvious missing spaces found in legacy
    # source content.
    replacements = {
        "andrenewable": "and renewable",
        "howto": "how to",
        "Costin": "Cost in",
        "expensivediesel": "expensive diesel",
        "thelarger": "the larger",
        "pumpingsystems": "pumping systems",
        "BeforeBuying": "Before Buying",
        "aSolar": "a Solar",
        "andpump": "and pump",
        "solar borehole": "solar borehole",
        "costofsolar": "cost of solar",
        "mucha home": "much a home",
    }

    for old, new in replacements.items():
        html = html.replace(old, new)

    match = re.search(
        r'(?is)<main[^>]*>(.*?)</main>',
        html
    )

    if not match:
        match = re.search(
            r'(?is)<article[^>]*>(.*?)</article>',
            html
        )

    if match:
        content = match.group(1)
    else:
        body = re.search(
            r'(?is)<body[^>]*>(.*?)</body>',
            html
        )

        content = (
            body.group(1)
            if body
            else html
        )

    content = re.sub(
        r'(?is)<script\b[^>]*>.*?</script>',
        '',
        content
    )

    content = re.sub(
        r'(?is)<style\b[^>]*>.*?</style>',
        '',
        content
    )

    content = re.sub(
        r'(?is)<nav\b[^>]*>.*?</nav>',
        '',
        content
    )

    # Remove legacy headers, but preserve any H1 contained inside them.
    # Some legacy articles place their only H1 inside the old header.
    def preserve_h1_from_header(match):
        header = match.group(0)

        h1s = re.findall(
            r'(?is)<h1\b[^>]*>.*?</h1>',
            header
        )

        return "\n".join(h1s)

    content = re.sub(
        r'(?is)<header\b[^>]*>.*?</header>',
        preserve_h1_from_header,
        content
    )

    content = re.sub(
        r'(?is)<footer\b[^>]*>.*?</footer>',
        '',
        content
    )

    # Remove old standalone contact blocks that may contain
    # duplicated navigation/contact markup.
    content = re.sub(
        r'(?is)<link\b[^>]*>',
        '',
        content
    )

    # Normalize old malformed entities where possible.

    # Migrate legacy internal URLs to the new route structure.
    legacy_routes = {
        "/blog/borehole-solarisation-cost-kenya.html":
            "/blog/borehole-solarisation-cost-kenya/",
        "/blog/solar-installation-cost-kenya.html":
            "/blog/solar-installation-cost-kenya/",
        "/borehole-solarisation-cost-kenya.html":
            "/blog/borehole-solarisation-cost-kenya/",
        "/solar-installation-cost-kenya.html":
            "/blog/solar-installation-cost-kenya/",
        "/solar-installation-kitui.html":
            "/locations/solar-installation-kitui/",
        "/solar-installation-machakos.html":
            "/locations/solar-installation-machakos/",
    }

    for old_url, new_url in legacy_routes.items():
        content = content.replace(old_url, new_url)
    content = unescape(content)

    # Enforce the official brand tagline if an old variant
    # appears in migrated content.
    old_taglines = [
        "Powering your property. Securing what matters.",
        "Powering Your Property. Securing What Matters.",
        "Powering your future. Protecting what matters.",
    ]

    for old in old_taglines:
        content = content.replace(
            old,
            OFFICIAL_TAGLINE
        )

    return content.strip()


def load_content_file(path):
    html = path.read_text(
        encoding="utf-8-sig"
    )

    return clean_source_html(html)


def extract_metadata(path, fallback_title, fallback_description):
    html = path.read_text(
        encoding="utf-8-sig"
    )

    title_match = re.search(
        r'(?is)<title[^>]*>(.*?)</title>',
        html
    )

    description_match = re.search(
        r'(?is)<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']',
        html
    )

    title = (
        unescape(title_match.group(1)).strip()
        if title_match
        else fallback_title
    )

    description = (
        unescape(description_match.group(1)).strip()
        if description_match
        else fallback_description
    )

    title = re.sub(r'\s+', ' ', title)
    description = re.sub(r'\s+', ' ', description)

    # Brand spelling corrections.
    title = title.replace(
        "BrianSolar",
        "Brian Solar"
    )

    title = title.replace(
        "Brian Solar & Electrical",
        "Brian Solar & Electrical"
    )

    title = title.replace(
        "Brian Solar& Electrical",
        "Brian Solar & Electrical"
    )

    description = description.replace(
        "BrianSolar",
        "Brian Solar"
    )

    description = description.replace(
        "Brian Solar & Electrical",
        "Brian Solar & Electrical"
    )

    description = description.replace(
        "Brian Solar& Electrical",
        "Brian Solar & Electrical"
    )

    # Normalize legacy metadata spacing.
    title = re.sub(r"\s*\|\s*Brian", " | Brian", title)

    description = description.replace("installationin", "installation in")
    description = description.replace("andborehole", "and borehole")
    description = description.replace("Kitengela.Solar", "Kitengela. Solar")
    description = description.replace("Kitui.Borehole", "Kitui. Borehole")
    description = description.replace("andwater", "and water")
    description = description.replace("homes,farms", "homes, farms")
    description = description.replace("batteries,borehole", "batteries, borehole")
    description = description.replace("0796 433537", "0796 433 537")
    return title, description


def build_content_page(
    source,
    output,
    fallback_title,
    fallback_description
):
    title, description = extract_metadata(
        source,
        fallback_title,
        fallback_description
    )

    content = load_content_file(source)

    # Calculator scripts are intentionally added after source cleanup.
    # clean_source_html() removes legacy <script> blocks from migrated
    # content, so the calculator assets must be attached here.
    if source.name == "calculator.html":
        content += """
<script src="/static/js/calculator/appliances.js"></script>
<script src="/static/js/calculator/locations.js"></script>
<script src="/static/js/calculator/solar-engine.js"></script>
<script src="/static/js/calculator/solar-sizing-calculator.js"></script>
"""

    page(
        output,
        "pages/content.html",
        title,
        description,
        page_content=content,
        article_schema=(source.parent.name.lower() == "blog")
    )


def write_sitemap():
    """
    Generate sitemap.xml from the final generated HTML routes.
    Legal pages are intentionally excluded from the SEO sitemap.
    """

    excluded = {
        "privacy-policy/index.html",
        "terms/index.html",
    }

    html_files = sorted(
        PUBLIC.rglob("*.html")
    )

    urls = []

    for file_path in html_files:
        relative = file_path.relative_to(PUBLIC).as_posix()

        if relative in excluded:
            continue

        if relative == "index.html":
            route = "/"
        elif relative.endswith("/index.html"):
            route = "/" + relative[:-len("index.html")]
        else:
            route = "/" + relative

        urls.append(
            DATA["domain"].rstrip("/") + route
        )

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]

    for url in urls:
        lines.append("  <url>")
        lines.append(
            "    <loc>"
            + escape(url)
            + "</loc>"
        )
        lines.append("  </url>")

    lines.append("</urlset>")

    (PUBLIC / "sitemap.xml").write_text(
        "\n".join(lines) + "\n",
        encoding="utf-8",
        newline="\n"
    )

    print(f"Sitemap URLs: {len(urls)}")

def build():
    clean_public()
    copy_static()

    # ---------------------------------------------------------
    # HOMEPAGE
    # ---------------------------------------------------------

    page(
        Path("index.html"),
        "pages/home.html",
        "Solar & Electrical Services in Kenya | CCTV & Electric Fence | Brian Solar",
        "Brian Solar & Electrical provides solar, electrical, CCTV and electric fence installation services across Kenya. Contact our team to discuss your project and request a quotation."
    )

    # ---------------------------------------------------------
    # SERVICES
    # ---------------------------------------------------------

    page(
        Path("services/index.html"),
        "pages/services.html",
        "Services | Brian Solar & Electrical",
        "Solar, electrical, CCTV and electric fence services from Brian Solar & Electrical."
    )

    for service in DATA["services"]:
        slug = service["slug"]

        page(
            Path("services")
            / slug
            / "index.html",
            f"pages/services/{slug}.html",
            f"{service['name']} Services | Brian Solar & Electrical",
            service["description"],
            service=service
        )

    # ---------------------------------------------------------
    # ABOUT
    # ---------------------------------------------------------

    page(
        Path("about/index.html"),
        "pages/about.html",
        "About Brian Solar & Electrical | Solar, Electrical, CCTV & Electric Fence Solutions in Kenya",
        "Learn about Brian Solar & Electrical, a Kenya-based technical services company providing solar, electrical, CCTV and electric fence solutions."
    )

    # ---------------------------------------------------------
    # PROJECTS
    # ---------------------------------------------------------

    page(
        Path("projects/index.html"),
        "pages/content.html",
        "Solar Projects | Brian Solar & Electrical",
        "Selected solar, electrical and technical projects completed by Brian Solar & Electrical.",
        page_content="""
<section class="section">
  <div class="container">
    <h1>Solar &amp; Electrical Projects</h1>
    <p>
      Explore completed installations by Brian Solar &amp; Electrical
      for homes, businesses, farms and institutions across Kenya.
    </p>
    <h2>Completed Solar &amp; Electrical Installations</h2>

    <div class="grid-3">
      <article class="card project-card">
        <img src="/static/images/projects/5kw-solar-installation/watermarked/optimized-900/completed-solar-installation.webp"
             alt="Completed 5kW lithium solar installation in Migori, Kenya"
             width="900" height="900" loading="lazy" decoding="async">
        <div class="project-card-content">
          <h3>5kW Solar Installation with Lithium Battery - Migori</h3>
          <p class="project-location">Migori, Kenya</p>
          <p>A completed installation featuring a 5kW wall-mounted inverter, 5.12kWh lithium battery storage and rooftop solar panels.</p>
          <div class="cta-buttons">
            <a class="btn btn-primary" href="/projects/5kw-lithium-solar-installation/">View Full Project</a>
            <a class="btn btn-secondary" href="/calculator/">Use Solar Calculator</a>
          </div>
        </div>
      </article>

      <article class="card project-card">
        <img src="/static/images/kitengela-complete-solar-installation.webp"
             alt="Completed 5kW residential solar installation in Kitengela"
             width="800" height="1067" loading="lazy" decoding="async">
        <div class="project-card-content">
          <h3>5kW Hybrid Solar Installation with Grid Backup - Kitengela</h3>
          <p class="project-location">Kitengela, Kajiado County</p>
          <p>A residential installation with a 5kW SRNE hybrid inverter, lithium battery storage, six solar panels and electrical protection.</p>
          <div class="cta-buttons">
            <a class="btn btn-primary" href="/projects/kitengela-5kw-solar-installation/">View Full Project</a>
            <a class="btn btn-secondary" href="/calculator/">Use Solar Calculator</a>
          </div>
        </div>
      </article>

      <article class="card project-card">
        <img src="/static/images/projects/nyahururu-5kw-solar/nyahururu-rooftop-panels.webp"
             alt="Rooftop solar panels for a 5kW hybrid installation in Nyahururu"
             width="900" height="900" loading="lazy" decoding="async">
        <div class="project-card-content">
          <h3>5kW Hybrid Solar Installation - Nyahururu</h3>
          <p class="project-location">Nyahururu, Kenya</p>
          <p>A 5kW inverter installation with one 5.12kWh battery and rooftop solar panels.</p>
          <div class="cta-buttons">
            <a class="btn btn-primary" href="/projects/nyahururu-5kw-solar-installation/">View Full Project</a>
            <a class="btn btn-secondary" href="/calculator/">Use Solar Calculator</a>
          </div>
        </div>
      </article>

      <article class="card project-card">
        <img src="/static/images/projects/runda-borehole-solar/runda-63-panel-solar-array.webp"
             alt="63-panel borehole solar array in Runda"
             width="900" height="900" loading="lazy" decoding="async">
        <div class="project-card-content">
          <h3>63-Panel Borehole Solar Installation - Runda</h3>
          <p class="project-location">Runda, Kenya</p>
          <p>A borehole solar installation featuring a 63-panel solar array and pump control equipment.</p>
          <div class="cta-buttons">
            <a class="btn btn-primary" href="/projects/runda-63-panel-borehole-solar/">View Full Project</a>
            <a class="btn btn-secondary" href="/calculator/">Use Solar Calculator</a>
          </div>
        </div>
      </article>

      <article class="card project-card">
        <img src="/static/images/projects/kiambu-solar/kiambu-18-panel-solar-array.webp"
             alt="18-panel solar array installation in Kiambu"
             width="900" height="900" loading="lazy" decoding="async">
        <div class="project-card-content">
          <h3>18-Panel Solar Installation - Kiambu</h3>
          <p class="project-location">Kiambu, Kenya</p>
          <p>An 18-panel solar array installation completed in Kiambu.</p>
          <div class="cta-buttons">
            <a class="btn btn-primary" href="/projects/kiambu-18-panel-solar-installation/">View Full Project</a>
            <a class="btn btn-secondary" href="/calculator/">Use Solar Calculator</a>
          </div>
        </div>
      </article>

      <article class="card project-card">
        <img src="/static/images/projects/electrical-installations/electrical-changeover.webp"
             alt="Electrical changeover installation"
             width="900" height="900" loading="lazy" decoding="async">
        <div class="project-card-content">
          <h3>Electrical Changeover Installations</h3>
          <p class="project-location">Kenya</p>
          <p>Examples of electrical changeover installations and different changeover arrangements.</p>
          <div class="cta-buttons">
            <a class="btn btn-primary" href="/projects/electrical-changeover-installations/">View Full Project</a>
            <a class="btn btn-secondary" href="/services/electrical/">Explore Electrical Services</a>
          </div>
        </div>
      </article>
    </div>
  </div>
</section>

<section class="section section-light">
  <div class="container">
    <h2>Planning Your Own Solar Installation?</h2>
    <p>
      Start with a preliminary estimate of your energy needs, explore our
      solar services or request a quotation from our team.
    </p>
    <div class="cta-buttons">
      <a class="btn btn-primary" href="/calculator/">Estimate Your Solar System</a>
      <a class="btn btn-secondary" href="/services/solar/">Explore Solar Services</a>
      <a class="btn btn-secondary" href="/#quotation">Request a Quotation</a>
    </div>
  </div>
</section>
"""
    )

    page(
        Path("projects/kitengela-5kw-solar-installation/index.html"),
        "pages/projects/kitengela-5kw-solar.html",
        "5kW Solar Installation with Automatic/Manual Grid Changeover in Kitengela | Brian Solar & Electrical",
        "Completed 5kW residential solar installation in Kitengela featuring an SRNE hybrid inverter, lithium battery storage and automatic/manual grid changeover, with solar power prioritised.",
        canonical=(
            DATA["domain"].rstrip("/")
            + "/projects/kitengela-5kw-solar-installation/"
        )
    )

    page(
        Path("projects/5kw-lithium-solar-installation/index.html"),
        "pages/projects/5kw-lithium-solar.html",
        "5kW Solar Installation with Lithium Battery in Migori | Brian Solar & Electrical",
        "Explore a completed solar installation in Migori featuring a 5kW wall-mounted inverter, 5.12kWh lithium battery and rooftop solar panels.",
        canonical=(
            DATA["domain"].rstrip("/")
            + "/projects/5kw-lithium-solar-installation/"
        )
    )

    page(
        Path("projects/nyahururu-5kw-solar-installation/index.html"),
        "pages/projects/nyahururu-5kw-solar.html",
        "5kW Hybrid Solar Installation in Nyahururu | Brian Solar & Electrical",
        "See a completed 5kW hybrid solar installation in Nyahururu featuring one 5.12kWh battery and rooftop solar panels.",
    )

    page(
        Path("projects/runda-63-panel-borehole-solar/index.html"),
        "pages/projects/runda-63-panel-borehole-solar.html",
        "63-Panel Borehole Solar Installation in Runda | Brian Solar & Electrical",
        "Explore a borehole solar installation in Runda featuring a 63-panel solar array and pump control equipment.",
    )

    page(
        Path("projects/kiambu-18-panel-solar-installation/index.html"),
        "pages/projects/kiambu-18-panel-solar.html",
        "18-Panel Solar Installation in Kiambu | Brian Solar & Electrical",
        "View an 18-panel solar installation project in Kiambu, Kenya, completed by Brian Solar & Electrical.",
    )

    page(
        Path("projects/electrical-changeover-installations/index.html"),
        "pages/projects/electrical-changeovers.html",
        "Electrical Changeover Installations in Kenya | Brian Solar & Electrical",
        "View electrical changeover installation work by Brian Solar & Electrical, including different changeover arrangements.",
    )
    # ---------------------------------------------------------
    # BLOG
    # ---------------------------------------------------------

    blog_files = [
        (
            "borehole-solarisation-cost-kenya.html",
            "Borehole Solarisation Cost in Kenya (2026 Guide)",
            "A guide to borehole solarisation, solar pumping systems, sizing and installation costs in Kenya."
        ),
        (
            "electrical-services-kenya.html",
            "Electrical Installation Services in Kenya",
            "Professional electrical installation, wiring, maintenance and repair services in Kenya."
        ),
        (
            "solar-installation-cost-kenya.html",
            "Solar Installation Cost in Kenya (2026 Guide)",
            "A guide to solar installation costs in Kenya, system sizing and the factors that affect pricing."
        ),
        (
            "solar-maintenance-services-kenya.html",
            "Solar Maintenance Services in Kenya",
            "Professional solar maintenance, repair and troubleshooting services across Kenya."
        ),
        (
            "solar-water-pump-prices-kenya.html",
            "Solar Water Pump Prices in Kenya (2026 Guide)",
            "A guide to solar water pump prices, system sizing, applications and installation in Kenya."
        ),
    ]

    blog_cards = []

    for filename, fallback_title, fallback_description in blog_files:
        source = CONTENT / "blog" / filename
        slug = Path(filename).stem

        output = (
            Path("blog")
            / slug
            / "index.html"
        )

        build_content_page(
            source,
            output,
            fallback_title,
            fallback_description
        )

        title, description = extract_metadata(
            source,
            fallback_title,
            fallback_description
        )

        blog_cards.append(
            f"""
<article>
  <h2>{escape(title)}</h2>
  <p>{escape(description)}</p>
  <p>
    <a href="/blog/{slug}/">Read article</a>
  </p>
</article>
"""
        )

    page(
        Path("blog/index.html"),
        "pages/content.html",
        "Solar & Electrical Guides | Brian Solar & Electrical",
        "Solar, electrical, maintenance and water pumping guides from Brian Solar & Electrical.",
        page_content="""
<section>
  <h1>Solar &amp; Electrical Guides</h1>
  <p>
    Practical guides covering solar power, electrical services,
    solar maintenance and water pumping in Kenya.
  </p>
"""
        + "\n".join(blog_cards)
        + """
</section>
"""
    )

    # ---------------------------------------------------------
    # LOCATIONS
    # ---------------------------------------------------------

    location_files = [
        (
            "solar-installation-kisumu.html",
            "Kisumu"
        ),
        (
            "solar-installation-kitengela.html",
            "Kitengela"
        ),
        (
            "solar-installation-kitui.html",
            "Kitui"
        ),
        (
            "solar-installation-machakos.html",
            "Machakos"
        ),
        (
            "solar-installation-mombasa.html",
            "Mombasa"
        ),
        (
            "solar-installation-nairobi.html",
            "Nairobi"
        ),
        (
            "solar-installation-thika.html",
            "Thika"
        ),
        (
            "solar-installation-kajiado.html",
            "Kajiado"
        ),
        (
            "solar-installation-nakuru.html",
            "Nakuru"
        ),
        (
            "solar-installation-eldoret.html",
            "Eldoret"
        ),
        (
            "solar-installation-meru.html",
            "Meru"
        ),
    ]

    location_cards = []

    for filename, location in location_files:
        source = CONTENT / "locations" / filename
        slug = Path(filename).stem

        output = (
            Path("locations")
            / slug
            / "index.html"
        )

        build_content_page(
            source,
            output,
            f"Solar, Electrical, CCTV & Electric Fence Services in {location} | Brian Solar & Electrical",
            f"Solar, electrical, CCTV and electric fence projects for homes, businesses and institutions in {location}, Kenya."
        )

        location_cards.append(
            f"""
<article>
  <h2>Services in {escape(location)}</h2>
  <p>
    Solar, electrical, CCTV and electric fence services for homes,
    businesses, farms and institutions in {escape(location)}.
  </p>
  <p>
    <a href="/locations/{slug}/">
      View services in {escape(location)}
    </a>
  </p>
</article>
"""
        )

    page(
        Path("locations/index.html"),
        "pages/content.html",
        "Service Areas in Kenya | Brian Solar & Electrical",
        "Solar, electrical, CCTV and electric fence projects for homes, businesses, farms and institutions across selected areas of Kenya.",
        page_content="""
<section>
  <h1>Service Areas Across Kenya</h1>
  <p>
    Brian Solar &amp; Electrical arranges solar, electrical, CCTV
    and electric fence projects across Kenya. Work is planned
    around each property's requirements and project scope.
  </p>
"""
        + "\n".join(location_cards)
        + """
</section>
"""
    )

    # ---------------------------------------------------------
    # FAQ
    # ---------------------------------------------------------

    page(
        Path("faq/index.html"),
        "pages/content.html",
        "Frequently Asked Questions | Brian Solar & Electrical",
        "Frequently asked questions about solar, electrical, CCTV and electric fence services.",
        page_content="""
<section class="faq-page">
  <h1>Frequently Asked Questions</h1>

  <div class="faq-list">
    <article class="faq-item">
      <h2>How much does a solar system cost in Kenya?</h2>
      <p>
        The cost depends on your energy needs, system size, equipment,
        battery capacity and installation requirements. Contact Brian Solar
        &amp; Electrical to discuss your project and request a quotation.
      </p>
    </article>

    <article class="faq-item">
      <h2>What size solar system do I need?</h2>
      <p>
        The right system depends on daily electricity consumption, appliances,
        peak power demand and backup requirements. These details help determine
        suitable panel, inverter and battery capacities.
      </p>
    </article>

    <article class="faq-item">
      <h2>Do you provide solar installation services in Kitengela?</h2>
      <p>
        Yes. We provide residential and commercial solar installation services
        in Kitengela, Kajiado County and surrounding areas, subject to project
        requirements.
      </p>
    </article>

    <article class="faq-item">
      <h2>Do you provide electrical installation and repair services?</h2>
      <p>
        Yes. Our electrical services include wiring, installations, upgrades,
        maintenance, repairs and troubleshooting for residential and commercial
        electrical systems.
      </p>
    </article>

    <article class="faq-item">
      <h2>Do you install and maintain CCTV systems?</h2>
      <p>
        Yes. We provide CCTV installation, system configuration and maintenance.
        The recommended setup depends on the property and coverage requirements.
      </p>
    </article>

    <article class="faq-item">
      <h2>Do you install and maintain electric fences?</h2>
      <p>
        Yes. We provide electric fence installation, maintenance and repair.
        The appropriate solution depends on the property layout and security needs.
      </p>
    </article>

    <article class="faq-item">
      <h2>Do you offer site assessments?</h2>
      <p>
        We discuss your project requirements and can arrange an on-site
        assessment where appropriate. Arrangements depend on the project
        and location.
      </p>
    </article>

    <article class="faq-item">
      <h2>Which areas do you serve?</h2>
      <p>
        Our service areas include Nairobi, Kiambu, Thika, Kajiado, Kitengela,
        Machakos, Kitui, Nakuru, Eldoret, Mombasa, Kisumu, Meru and surrounding
        areas. We also consider projects elsewhere in Kenya, depending on
        project scope and location.
      </p>
    </article>

    <article class="faq-item">
      <h2>What happens after I request a quotation?</h2>
      <p>
        We review the information you provide and may contact you to clarify
        your requirements. We then consider the project details and prepare
        a suitable technical solution and quotation.
      </p>
    </article>
  </div>
</section>
"""
    )

    # ---------------------------------------------------------
    # ---------------------------------------------------------
    # CONTACT
    # ---------------------------------------------------------

    page(
        Path("contact/index.html"),
        "pages/content.html",
        "Contact Brian Solar & Electrical | Kenya",
        "Contact Brian Solar & Electrical about solar, electrical, CCTV and electric fence projects anywhere in Kenya.",
        page_content=f"""
<section>
  <h1>Contact Brian Solar &amp; Electrical</h1>

  <p>
    Contact our team to discuss Solar, Electrical, CCTV or Electric Fence
    installation, maintenance, repairs and other project requirements.
    We serve homes, businesses, farms and institutions across Kenya.
  </p>

  <h2>Tell us about your project</h2>
  <p>
    When making an enquiry, please share your location, the service you
    need, a brief description of the work and your preferred timeframe.
    Photos or other relevant details can also help us understand the
    requirements.
  </p>

  <h2>Call us</h2>
  <p>
    Speak to our team on
    <a href="tel:{DATA["phone"]}">{escape(DATA["phone_display"])}</a>.
  </p>

  <h2>WhatsApp enquiries</h2>
  <p>
    <a href="{escape(DATA["whatsapp_url"])}">
      Chat with Brian Solar &amp; Electrical on WhatsApp
    </a>
    to share your project details and relevant photos.
  </p>

  <h2>Email</h2>
  <p>
    Send your enquiry to
    <a href="mailto:{escape(DATA["email"])}">{escape(DATA["email"])}</a>.
  </p>

  <h2>Our services</h2>
  <ul>
    <li><a href="/services/solar/">Solar installation and solutions</a></li>
    <li><a href="/services/electrical/">Electrical installation and services</a></li>
    <li><a href="/services/cctv/">CCTV installation and services</a></li>
    <li><a href="/services/electric-fence/">Electric fence installation and services</a></li>
  </ul>

  <h2>What happens after you enquire?</h2>
  <p>
    We review the information you provide and may contact you to clarify
    the project requirements. Where an assessment or site visit is needed,
    any applicable charges will be explained and agreed with you before
    the visit. We can then discuss a suitable solution and quotation based
    on the scope of work.
  </p>
</section>
"""
    )

    # SOLAR SIZING CALCULATOR
    # ---------------------------------------------------------

    build_content_page(
        CONTENT / "calculator.html",
        Path("calculator/index.html"),
        "Solar System Sizing Calculator Kenya | Brian Solar & Electrical",
        "Calculate your estimated solar panel, inverter and battery requirements in Kenya."
    )
    # LEGAL PAGES
    # ---------------------------------------------------------

    build_content_page(
        CONTENT / "privacy-policy.html",
        Path("privacy-policy/index.html"),
        "Privacy Policy | Brian Solar & Electrical",
        "Privacy Policy for Brian Solar & Electrical."
    )

    build_content_page(
        CONTENT / "terms-of-service.html",
        Path("terms/index.html"),
        "Terms of Service | Brian Solar & Electrical",
        "Terms of Service for Brian Solar & Electrical."
    )

    # ---------------------------------------------------------
    # ROBOTS
    # ---------------------------------------------------------

    robots = f"""User-agent: *
Allow: /

Sitemap: {DATA["domain"].rstrip("/")}/sitemap.xml
"""

    # Generate sitemap after all HTML pages exist.
    write_sitemap()
    (PUBLIC / "robots.txt").write_text(
        robots,
        encoding="utf-8",
        newline="\n"
    )

    print("")
    print(f"Built site into: {PUBLIC}")


if __name__ == "__main__":
    build()










