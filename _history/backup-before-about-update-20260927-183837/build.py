from pathlib import Path
import json
import re
import shutil
from html import escape

ROOT = Path(__file__).parent
PUBLIC = ROOT / "public"
DATA = json.loads((ROOT / "data" / "business.json").read_text(encoding="utf-8-sig"))
TEMPLATES = ROOT / "templates"
STATIC = ROOT / "static"


def render(template, **ctx):
    path = TEMPLATES / template
    text = path.read_text(encoding="utf-8-sig")

    # Expand includes.
    include_pattern = re.compile(r'{%\s*include\s+"([^"]+)"\s*%}')

    while True:
        match = include_pattern.search(text)
        if not match:
            break

        include_name = match.group(1)
        include_path = TEMPLATES / include_name
        include_text = include_path.read_text(encoding="utf-8-sig")

        text = (
            text[:match.start()]
            + include_text
            + text[match.end():]
        )

    # Expand service loop.
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
                    r'{{\s*service\.' + re.escape(key) + r'\s*}}'
                )
                item = pattern.sub(escape(str(value)), item)

            output.append(item)

        return "".join(output)

    text = loop_pattern.sub(render_services, text)

    # Service object placeholders.
    service = ctx.get("service")

    if service:
        for key, value in service.items():
            pattern = re.compile(
                r'{{\s*service\.' + re.escape(key) + r'\s*}}'
            )
            text = pattern.sub(escape(str(value)), text)

    # Business and page placeholders.
    replacements = {
        "business_name": DATA["name"],
        "registered_name": DATA["registered_name"],
        "email": DATA["email"],
        "phone": DATA["phone"],
        "phone_display": DATA["phone_display"],
        "whatsapp_url": DATA["whatsapp_url"],
        "domain": DATA["domain"],
    }

    for key, value in ctx.items():
        if isinstance(value, str):
            replacements[key] = value

    for key, value in replacements.items():
        pattern = re.compile(
            r'{{\s*' + re.escape(key) + r'\s*}}'
        )
        text = pattern.sub(lambda m, v=str(value): v, text)

    return text


def page(path, template, title, description, canonical=None, **ctx):
    out = PUBLIC / path
    out.parent.mkdir(parents=True, exist_ok=True)

    if canonical is None:
        if path == Path("index.html"):
            canonical = DATA["domain"].rstrip("/") + "/"
        else:
            clean = str(path).replace("\\", "/")

            if clean.endswith("/index.html"):
                clean = clean[:-len("/index.html")]

            canonical = DATA["domain"].rstrip("/") + "/" + clean + "/"

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
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)


def clean_public():
    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)

    PUBLIC.mkdir(parents=True)


def build():
    clean_public()
    copy_static()

    # Homepage
    page(
        Path("index.html"),
        "pages/home.html",
        "Brian Solar & Electrical | Solar, Electrical, CCTV & Electric Fence",
        "Brian Solar & Electrical provides solar, electrical, CCTV and electric fence services across Kenya."
    )

    # Services index
    page(
        Path("services/index.html"),
        "pages/services.html",
        "Services | Brian Solar & Electrical",
        "Solar, electrical, CCTV and electric fence services from Brian Solar & Electrical."
    )

    # Individual services
    for service in DATA["services"]:
        slug = service["slug"]

        page(
            Path("services") / slug / "index.html",
            f"pages/services/{slug}.html",
            f"{service['name']} Services | Brian Solar & Electrical",
            service["description"],
            service=service
        )

    # Initial project/case study
    page(
        Path("projects/kitengela-5kw-solar-installation/index.html"),
        "pages/projects/kitengela-5kw-solar.html",
        "5kW Off-Grid Solar Installation in Kitengela | Brian Solar & Electrical",
        "A completed 5kW residential solar installation in Kitengela, Kajiado County.",
        canonical=(
            DATA["domain"].rstrip("/")
            + "/projects/kitengela-5kw-solar-installation/"
        )
    )

    print(f"Built site into: {PUBLIC}")


if __name__ == "__main__":
    build()