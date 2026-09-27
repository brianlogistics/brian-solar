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


def page(
    path,
    template,
    title,
    description,
    canonical=None,
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

    html = render(
        "base.html",
        content=content,
        title=escape(title),
        description=escape(description),
        canonical=canonical
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


def clean_public():
    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)

    PUBLIC.mkdir(parents=True)


def clean_source_html(html):
    """
    Extract useful content from legacy HTML.

    Some migrated source files contain escaped HTML such as
    \\<h1> and \\</h1>. Normalize those before parsing so that
    headings inside legacy headers are not accidentally removed.
    """

    # Normalize escaped HTML markup before extraction.
    html = html.replace("\\<", "<")
    html = html.replace("\\>", ">")

    # Repair common UTF-8/Windows-1252 mojibake introduced in
    # older migrated files. Apply at most two passes.
    for _ in range(2):
        bad_before = sum(
            html.count(ch)
            for ch in ("Ã", "Â", "â")
        )

        try:
            repaired = html.encode("latin1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            break

        bad_after = sum(
            repaired.count(ch)
            for ch in ("Ã", "Â", "â")
        )

        if bad_after < bad_before:
            html = repaired
        else:
            break

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

    content = re.sub(
        r'(?is)<header\b[^>]*>.*?</header>',
        '',
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
        "Brian Solar &Electrical",
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
        "Brian Solar &Electrical",
        "Brian Solar & Electrical"
    )

    description = description.replace(
        "Brian Solar& Electrical",
        "Brian Solar & Electrical"
    )

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

    page(
        output,
        "pages/content.html",
        title,
        description,
        page_content=content
    )


def build():
    clean_public()
    copy_static()

    # ---------------------------------------------------------
    # HOMEPAGE
    # ---------------------------------------------------------

    page(
        Path("index.html"),
        "pages/home.html",
        "Solar, Electrical, CCTV & Electric Fence Solutions in Kenya | Brian Solar & Electrical",
        "Brian Solar & Electrical provides solar, electrical, CCTV and electric fence services across Kenya."
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

    project_title = (
        "5kW Off-Grid Solar Installation in Kitengela"
    )

    project_description = (
        "A completed 5kW residential solar installation "
        "in Kitengela, Kajiado County."
    )

    page(
        Path("projects/index.html"),
        "pages/content.html",
        "Solar Projects | Brian Solar & Electrical",
        "Selected solar, electrical and technical projects completed by Brian Solar & Electrical.",
        page_content="""
<section>
  <h1>Solar &amp; Electrical Projects</h1>
  <p>
    Explore selected projects completed by Brian Solar &amp; Electrical
    for residential, commercial, agricultural and other clients.
  </p>

  <article>
    <h2>5kW Off-Grid Solar Installation in Kitengela</h2>
    <p>
      A completed residential solar installation in Kitengela,
      Kajiado County, featuring solar panels, hybrid inverter,
      lithium battery storage and electrical protection.
    </p>
    <p>
      <a href="/projects/kitengela-5kw-solar-installation/">
        View the Kitengela project
      </a>
    </p>
  </article>
</section>
"""
    )

    page(
        Path(
            "projects/kitengela-5kw-solar-installation/index.html"
        ),
        "pages/projects/kitengela-5kw-solar.html",
        project_title
        + " | Brian Solar & Electrical",
        project_description,
        canonical=(
            DATA["domain"].rstrip("/")
            + "/projects/kitengela-5kw-solar-installation/"
        )
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
            f"Solar Installation in {location} | Brian Solar & Electrical",
            f"Professional solar installation services in {location}, Kenya."
        )

        location_cards.append(
            f"""
<article>
  <h2>Solar Installation in {escape(location)}</h2>
  <p>
    Solar installation services for homes, businesses,
    farms and institutions in {escape(location)}.
  </p>
  <p>
    <a href="/locations/{slug}/">
      View {escape(location)} solar services
    </a>
  </p>
</article>
"""
        )

    page(
        Path("locations/index.html"),
        "pages/content.html",
        "Solar Installation Locations in Kenya | Brian Solar & Electrical",
        "Solar installation and solar water pumping services in selected locations across Kenya.",
        page_content="""
<section>
  <h1>Solar Installation Locations</h1>
  <p>
    Brian Solar &amp; Electrical provides solar installation,
    backup power and solar water pumping services across Kenya.
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
<section>
  <h1>Frequently Asked Questions</h1>

  <h2>How much does solar cost in Kenya?</h2>
  <p>
    Solar system prices depend on system size, equipment,
    battery capacity, installation requirements and energy needs.
    Contact Brian Solar &amp; Electrical for a site assessment
    and quotation.
  </p>

  <h2>Do you provide solar installation services in Kitengela?</h2>
  <p>
    Yes. Brian Solar &amp; Electrical provides residential and
    commercial solar installation services in Kitengela,
    Kajiado County and surrounding areas.
  </p>

  <h2>Do you provide electrical installation services?</h2>
  <p>
    Yes. Our electrical services include wiring, installations,
    upgrades, maintenance, repairs and troubleshooting.
  </p>

  <h2>Do you install CCTV systems?</h2>
  <p>
    Yes. We provide CCTV installation, configuration and
    maintenance services.
  </p>

  <h2>Do you install electric fences?</h2>
  <p>
    Yes. We provide electric fence installation, maintenance
    and repair services.
  </p>
</section>
"""
    )

    # ---------------------------------------------------------
    # CONTACT
    # ---------------------------------------------------------

    page(
        Path("contact/index.html"),
        "pages/content.html",
        "Contact Brian Solar & Electrical | Kenya",
        "Contact Brian Solar & Electrical for solar, electrical, CCTV and electric fence services in Kenya.",
        page_content=f"""
<section>
  <h1>Contact Brian Solar &amp; Electrical</h1>

  <p>
    Contact us for solar, electrical, CCTV and electric fence
    installation, maintenance and technical support.
  </p>

  <h2>Phone</h2>
  <p>
    <a href="tel:{DATA["phone"]}">
      {escape(DATA["phone_display"])}
    </a>
  </p>

  <h2>WhatsApp</h2>
  <p>
    <a href="{escape(DATA["whatsapp_url"])}">
      Chat with us on WhatsApp
    </a>
  </p>

  <h2>Email</h2>
  <p>
    <a href="mailto:{escape(DATA["email"])}">
      {escape(DATA["email"])}
    </a>
  </p>
</section>
"""
    )

    # ---------------------------------------------------------
    # LEGAL PAGES
    # ---------------------------------------------------------

    build_content_page(
        LEGACY / "privacy-policy.html",
        Path("privacy-policy/index.html"),
        "Privacy Policy | Brian Solar & Electrical",
        "Privacy Policy for Brian Solar & Electrical."
    )

    build_content_page(
        LEGACY / "terms-of-service.html",
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

    (PUBLIC / "robots.txt").write_text(
        robots,
        encoding="utf-8",
        newline="\n"
    )

    print("")
    print(f"Built site into: {PUBLIC}")


if __name__ == "__main__":
    build()

